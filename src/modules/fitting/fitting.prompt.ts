import type { ClothingType } from '@prisma/client';

// ───────────────────────────── 2D 코디 프롬프트 구성/파싱 (순수 함수) ─────────────────────────────
// I/O·DB·외부 API에 의존하지 않는 프롬프트 텍스트 생성 및 응답 파싱 전용 모듈.

const DEFAULT_OUTFIT_NAME = '데일리 코디';
const MAX_OUTFIT_NAME_LENGTH = 20;

/** 카테고리 → 한국어 표기. (service의 에러 메시지·DB 기본 상품명 등 사용자 노출용) */
export const CATEGORY_LABEL: Record<ClothingType, string> = {
    HAT: '모자',
    OUTER: '아우터',
    TOP: '상의',
    BOTTOM: '하의',
    SHOES: '신발',
};

/** 카테고리 → 영어 표기. (Gemini 프롬프트용) */
export const CATEGORY_EN: Record<ClothingType, string> = {
    HAT: 'Hat',
    OUTER: 'Outer',
    TOP: 'Top',
    BOTTOM: 'Bottom',
    SHOES: 'Shoes',
};

// 의류 재현 규칙은 소스(캐릭터/업로드 사진)와 무관하게 항상 동일하다. (작업 프레이밍은 소스별 정체성 규칙에 둔다)
const SYSTEM_GARMENT_RULE =
    'You are a fashion stylist AI. ' +
    'Garment rule: Reproduce each garment EXACTLY as in its source image — identical color, pattern, texture, print/logo, silhouette, and proportions. ' +
    'Do not redesign, recolor, simplify, or add/remove any details of the garments. Only adapt their fit onto the subject\'s body.';

// 소스가 "프리셋 캐릭터(얼굴 없는 아바타)"일 때의 정체성 규칙. → 전신 스튜디오 이미지를 생성.
const SYSTEM_IDENTITY_CHARACTER =
    'Task: dress the stylized avatar in image 1 with the provided garments and generate a single styled full-body outfit image. ' +
    'The subject in image 1 is a stylized avatar. ' +
    'Reproduce it exactly — same face, figure, proportions, material, color, art style, AND the exact same pose, body orientation, limb positions, and camera angle/framing. Never re-pose, rotate, or re-frame it. ' +
    'It has a smooth, featureless face: do not add eyes, nose, mouth, eyebrows, or hair, do not give it realistic human skin, and do not turn it into a real person. ' +
    'It looks mannequin-like, but do NOT render it as a generic store mannequin either — match image 1 as closely as possible. ' +
    'If the avatar is non-human or stylized, preserve its original form and art style and never convert it into a realistic human. ' +
    'You may only change the worn garments, shoes, and accessories.';

// 소스가 "사용자가 업로드한 실제 인물 사진"일 때의 정체성 규칙. → 새 생성이 아니라 원본을 그대로 두는 in-place 편집.
const SYSTEM_IDENTITY_UPLOAD =
    'Task: this is an IN-PLACE PHOTO EDIT of image 1, NOT a new image generation. ' +
    'Image 1 is a real, uploaded photo of a person. Take image 1 as the canvas and change ONLY the clothing they wear, leaving everything else byte-for-byte as close to the original as possible. ' +
    'Preserve the person EXACTLY — same face and facial features, identity, hair, skin tone, body shape, proportions, AND the exact same pose, body orientation, limb positions, camera angle, crop, framing, lighting, and background. ' +
    'Never re-pose, rotate, re-frame, re-light, or replace the background. Do NOT stylize, cartoonify, beautify, slim, retouch, or turn the person into a featureless avatar/mannequin — they must remain the same photorealistic real person, instantly recognizable as image 1. ' +
    'You may only change the worn garments, shoes, and accessories.';

/** 프롬프트 구성에 필요한 의류 정보 (이미지 등 I/O 필드는 제외). */
export type PromptGarment = {
    category: ClothingType;
    selectedSize?: string;
    measurements: Record<string, number>;
};

/** 치수 맵을 "항목 N cm" 라인으로 합친다. (separator로 신체/의류 표기 구분) */
function formatMeasurements(measurements: Record<string, number>, separator: string): string {
    const lines = Object.entries(measurements)
        .filter(([, v]) => typeof v === 'number')
        .map(([k, v]) => `${k} ${v}cm`);
    return lines.length > 0 ? lines.join(separator) : 'N/A';
}

/** 의류별 [의류 정보] 블록(카테고리/선택 사이즈/치수)을 입력 순서대로 만든다. */
function buildClothingInfoBlocks(garments: PromptGarment[]): string {
    return garments
        .map((g) =>
            [
                `- Category: ${CATEGORY_EN[g.category]}`,
                `- Selected size: ${g.selectedSize ?? 'Not specified'}`,
                `- Measurements: ${formatMeasurements(g.measurements, ' / ')}`,
            ].join('\n'),
        )
        .join('\n\n');
}

/**
 * 아바타·신체·의류 정보를 조합해 Gemini 멀티모달 텍스트 프롬프트를 만든다.
 * isUploadedImage에 따라 정체성 규칙이 갈린다:
 *  - false(프리셋 캐릭터): 얼굴 없는 아바타 형태/아트스타일 유지
 *  - true(업로드 사진):   실제 인물의 얼굴·정체성·체형을 그대로 보존 (마네킹화 금지)
 */
export function buildCoordiPrompt(params: {
    gender: string;
    height: number | null;
    weight: number | null;
    bodyMeasurements: Record<string, number>;
    garments: PromptGarment[];
    isUploadedImage: boolean;
}): string {
    const { gender, height, weight, bodyMeasurements, garments, isUploadedImage } = params;

    const systemInstruction = `${SYSTEM_GARMENT_RULE} ${isUploadedImage ? SYSTEM_IDENTITY_UPLOAD : SYSTEM_IDENTITY_CHARACTER}`;

    // [Request] 정체성 항목·CRITICAL 문구를 소스별로 분기
    const requestIdentity = isUploadedImage
        ? 'Keep the person 100% identical to image 1 — same face, identity, hair, skin tone, body shape, pose, body orientation, and camera angle. Do not stylize, beautify, or alter the person; keep them photorealistic. Only the garments may change.'
        : 'Keep the avatar 100% identical to image 1 — same featureless face, figure, art style, pose, body orientation, and camera angle. Do not add eyes, nose, mouth, or hair, and do not make it a realistic human. Do not re-pose or rotate the avatar. Only the garments may change.';

    const criticalIdentity = isUploadedImage
        ? 'CRITICAL (person identity & pose): Reproduce the person EXACTLY as in image 1 — same face and facial features, identity, hair, skin tone, body shape, ' +
          'and the SAME pose, stance, body orientation, limb positions, and camera angle/framing. ' +
          'Do NOT re-pose, rotate, re-frame, stylize, or beautify the person, and do NOT turn them into a featureless avatar or mannequin. Keep them a photorealistic real person. ONLY change the clothing.'
        : 'CRITICAL (avatar identity & pose): Reproduce the avatar EXACTLY as in image 1 — same smooth, featureless face ' +
          '(no eyes, no nose, no mouth, no eyebrows, no hair, no realistic human skin), same figure and art style, ' +
          'and the SAME pose, stance, body orientation, limb positions, and camera angle/framing as image 1. ' +
          'Do NOT re-pose, rotate, or re-frame the avatar. Do NOT turn it into a real human, and do NOT restyle it as a generic store mannequin. ONLY change the clothing.';

    // 요청·출력 항목을 소스별로 분기.
    //  - 캐릭터: 전신 스튜디오 이미지를 새로 생성 (검은 베이스 레이어 제거 포함)
    //  - 업로드: 원본 사진을 그대로 두고 옷만 교체하는 in-place 편집 (배경/구도/크롭 보존)
    const requests = isUploadedImage
        ? [
              'Edit image 1 in place: keep the person, their face, hair, body, pose, the background, lighting, and the original crop/framing exactly as in image 1.',
              requestIdentity,
              'Replace ONLY the clothing with the provided garments, fitting them naturally onto the body. Do not change anything else in the image.',
              'Naturally complete any clothing categories that are not provided, matching the overall style.',
          ]
        : [
              'Generate a single full-body image of the avatar (image 1) wearing all the garments.',
              requestIdentity,
              'Remove the black base layer (leggings/tights and tight top) the avatar wears in image 1; show the avatar\'s bare body surface where the provided garments do not cover.',
              'Naturally complete any categories that are not provided.',
              'Use a clean studio-style background.',
              'Frame the entire body from head to toe; do not crop the head.',
          ];

    const outputLines = isUploadedImage
        ? [
              '- Output the edited version of image 1 with the SAME composition, crop, background, and lighting — only the clothing differs. (Image only.)',
              '- The person must remain fully recognizable as the exact same individual in image 1.',
          ]
        : [
              '- Generate and output a single full-body image of the styled outfit. (Image only.)',
              '- The full body must be visible from head to toe without any cropping.',
          ];

    return [
        systemInstruction,
        '',
        '[User Info]',
        `- Gender: ${gender}`,
        `- Height: ${height ?? 'N/A'}cm / Weight: ${weight ?? 'N/A'}kg`,
        `- Body measurements: ${formatMeasurements(bodyMeasurements, ', ')}`,
        '',
        '[Garments]',
        buildClothingInfoBlocks(garments),
        '',
        '[Images]',
        `- Image 1: subject (fixed — ${isUploadedImage ? 'real uploaded photo' : 'stylized avatar'})`,
        '- Image 2: a contact sheet of ALL garments to put on the subject. Each cell is one garment, labeled with its number and category (e.g. "1. Top", "2. Bottom"). The labels match the [Garments] list below in order. Apply every garment shown to the matching body part.',
        '',
        '[Request]',
        ...requests.map((line, i) => `${i + 1}. ${line}`),
        '',
        '[Output — VERY IMPORTANT]',
        ...outputLines,
        '',
        criticalIdentity,
        'CRITICAL (garment fidelity): Each garment must look identical to its cell in the image 2 contact sheet — same color, pattern, print/logo, and shape. ' +
            'Do not alter, recolor, or redesign the garments, and ignore the sheet\'s white background and labels; only fit each garment naturally onto the body.',
    ].join('\n');
}

/** 의류 구성으로 코디명을 짓도록 시키는 텍스트 프롬프트를 만든다 (텍스트 모델용). 지시문은 영어, 결과 코디명은 한국어. */
export function buildOutfitNamePrompt(garments: Array<{ category: ClothingType; title?: string }>): string {
    const lines = garments.map((g) => `- ${CATEGORY_EN[g.category]}: ${g.title ?? CATEGORY_EN[g.category]}`);
    return [
        'Create exactly one Korean outfit name (max 20 characters) that suits the outfit below.',
        'Output only the outfit name text in Korean — no explanation, no quotes.',
        '',
        ...lines,
    ].join('\n');
}

/** 모델이 돌려준 텍스트에서 코디명을 추출한다. JSON → "코디명: OOO" → 평문 → 기본값 순으로 폴백한다. */
export function parseOutfitName(text: string): string {
    const trimmed = text.trim();

    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]) as { outfit_name?: unknown };
            if (typeof parsed.outfit_name === 'string' && parsed.outfit_name.trim()) {
                return parsed.outfit_name.trim().slice(0, MAX_OUTFIT_NAME_LENGTH);
            }
        } catch {
            // JSON 파싱 실패 시 평문 폴백
        }
    }

    // "코디명: OOO" / "outfit_name: OOO" 같은 라벨 접두사를 제거하고 첫 줄만 사용
    const firstLine = trimmed.split('\n').find((l) => l.trim()) ?? '';
    const label = firstLine.replace(/^\s*(코디명|outfit_name)\s*[:：]\s*/i, '').trim();
    if (label) return label.slice(0, MAX_OUTFIT_NAME_LENGTH);

    if (trimmed) return trimmed.slice(0, MAX_OUTFIT_NAME_LENGTH);
    return DEFAULT_OUTFIT_NAME;
}

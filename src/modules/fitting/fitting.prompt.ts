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

const SYSTEM_INSTRUCTION =
    'You are a fashion stylist AI. Dress the avatar in image 1 with the provided garment images and generate a single styled outfit image. ' +
    'Rules: 1. Reproduce each garment EXACTLY as in its source image — identical color, pattern, texture, print/logo, silhouette, and proportions. ' +
    'Do not redesign, recolor, simplify, or add/remove any details of the garments. Only adapt their fit onto the avatar\'s body. ' +
    '2. Reproduce the avatar (image 1) exactly as it is — same face, figure, proportions, material, color, and art style. You may only change the worn garments, shoes, and accessories. ' +
    '3. The avatar has a smooth, featureless face. Keep it exactly that way: do not add eyes, nose, mouth, eyebrows, or hair, do not give it realistic human skin, and do not turn it into a real person. ' +
    'It looks mannequin-like, but do NOT render it as a generic store mannequin either — simply match image 1 as closely as possible. ' +
    '4. If the avatar is a non-human or stylized character, likewise preserve its original form and art style and never convert it into a realistic human.';

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

/** 아바타·신체·의류 정보를 조합해 Gemini 멀티모달 텍스트 프롬프트를 만든다. */
export function buildCoordiPrompt(params: {
    gender: string;
    height: number | null;
    weight: number | null;
    bodyMeasurements: Record<string, number>;
    garments: PromptGarment[];
}): string {
    const { gender, height, weight, bodyMeasurements, garments } = params;
    const lastIndex = garments.length + 1; // 1번은 아바타, 2번부터 의류

    return [
        SYSTEM_INSTRUCTION,
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
        '- Image 1: avatar (fixed)',
        `- Images 2-${lastIndex}: garments in category order`,
        '',
        '[Request]',
        '1. Generate a single full-body image of the avatar (image 1) wearing all the garments.',
        '2. Keep the avatar 100% identical to image 1 — same featureless face, figure, and art style. Do not add eyes, nose, mouth, or hair, and do not make it a realistic human. Only the garments may change.',
        '3. Remove the black base layer (leggings/tights and tight top) the avatar wears in image 1; show the avatar\'s bare body surface where the provided garments do not cover.',
        '4. Naturally complete any categories that are not provided.',
        '5. Use a clean studio-style background.',
        '6. Frame the entire body from head to toe; do not crop the head.',
        '',
        '[Output — VERY IMPORTANT]',
        '- Generate and output a single full-body image of the styled outfit. (Image only.)',
        '- The full body must be visible from head to toe without any cropping.',
        '',
        'CRITICAL (avatar identity): Reproduce the avatar EXACTLY as in image 1 — same smooth, featureless face ' +
            '(no eyes, no nose, no mouth, no eyebrows, no hair, no realistic human skin), same figure and art style. ' +
            'Do NOT turn it into a real human, and do NOT restyle it as a generic store mannequin. ONLY change the clothing.',
        'CRITICAL (garment fidelity): Each garment must look identical to its source image — same color, pattern, print/logo, and shape. ' +
            'Do not alter, recolor, or redesign the garments; only fit them naturally onto the body.',
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

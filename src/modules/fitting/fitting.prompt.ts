import type { ClothingType } from '@prisma/client';

// ───────────────────────────── 2D 코디 프롬프트 구성/파싱 (순수 함수) ─────────────────────────────
// I/O·DB·외부 API에 의존하지 않는 프롬프트 텍스트 생성 및 응답 파싱 전용 모듈.

const DEFAULT_OUTFIT_NAME = '데일리 코디';
const MAX_OUTFIT_NAME_LENGTH = 20;

/** 카테고리 → 한국어 표기. */
export const CATEGORY_LABEL: Record<ClothingType, string> = {
    HAT: '모자',
    OUTER: '아우터',
    TOP: '상의',
    BOTTOM: '하의',
    SHOES: '신발',
};

const SYSTEM_INSTRUCTION =
    '당신은 패션 스타일리스트 AI입니다. 아바타 이미지와 의류 이미지들을 분석해 코디 이미지를 생성하고 코디명을 부여합니다. ' +
    '규칙: 1. 코디명은 20자 이내 한국어로 작성합니다. 2. 의류의 색상, 디자인, 패턴은 원본 이미지와 동일하게 유지합니다. ' +
    '3. 아바타의 얼굴형, 헤어스타일, 피부톤, 체형, 아트스타일은 절대 변경하지 않습니다. ' +
    '4. 변경 가능한 항목은 착용 의류, 신발, 액세서리뿐입니다. ' +
    '5. 아바타가 사람이 아닌 캐릭터(동물·가상 캐릭터·일러스트 등)이면 절대 사람으로 바꾸지 말고, 원본 캐릭터의 종·형태·아트스타일을 그대로 유지합니다.';

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
    return lines.length > 0 ? lines.join(separator) : '미제공';
}

/** 의류별 [의류 정보] 블록(카테고리/선택 사이즈/치수)을 입력 순서대로 만든다. */
function buildClothingInfoBlocks(garments: PromptGarment[]): string {
    return garments
        .map((g) =>
            [
                `- 카테고리: ${CATEGORY_LABEL[g.category]}`,
                `- 선택 사이즈: ${g.selectedSize ?? '미지정'}`,
                `- 치수: ${formatMeasurements(g.measurements, ' / ')}`,
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
        '[사용자 정보]',
        `- 성별: ${gender}`,
        `- 키: ${height ?? '미제공'}cm / 몸무게: ${weight ?? '미제공'}kg`,
        `- 신체 치수: ${formatMeasurements(bodyMeasurements, ', ')}`,
        '',
        '[의류 정보]',
        buildClothingInfoBlocks(garments),
        '',
        '[이미지]',
        '- 1번: 아바타 (고정)',
        `- 2번~${lastIndex}번: 카테고리 순서대로 의류`,
        '',
        '[요청]',
        '1. 아바타에 의류를 모두 착용시킨 전신 코디 이미지 1장을 생성하세요.',
        '2. 아바타 캐릭터는 절대 변형하지 마세요. 아바타가 사람이 아닌 캐릭터(동물·가상 캐릭터·일러스트 등)면 사람으로 바꾸지 말고 원본 캐릭터를 그대로 사용하세요.',
        '3. 제공되지 않은 카테고리는 자연스럽게 완성하세요.',
        '4. 배경은 깔끔한 스튜디오 스타일로 설정하세요.',
        '5. 머리(얼굴) 끝부터 발끝까지 전신이 모두 프레임 안에 들어오게 구성하고, 얼굴이나 머리가 잘리지 않게 하세요.',
        '',
        '[출력 — 매우 중요]',
        '- 반드시 코디를 착용한 전신 이미지를 생성해서 출력하세요. 이미지 출력은 필수이며, 텍스트만 응답하는 것은 금지입니다.',
        '- 얼굴/머리가 잘리지 않은 완전한 전신 이미지여야 합니다.',
        '- 이미지와 함께 코디명을 "코디명: OOO" 형식의 짧은 한국어 한 줄(20자 이내)로 덧붙이세요.',
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

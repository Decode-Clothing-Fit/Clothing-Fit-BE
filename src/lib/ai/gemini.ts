import { GoogleGenAI } from '@google/genai';
import { env } from '@/config/env';

export const gemini = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';
/** 멀티모달 이미지 생성 응답 타임아웃 (응답 없이 멈춘 요청이 무한 대기하지 않도록) */
const GEMINI_TIMEOUT_MS = 60_000;
/** 최초 1회 + 실패 시 재시도 2회. 이미지 모델이 간헐적으로 이미지 없이(텍스트만) 응답하는 것에 대비 */
const MAX_ATTEMPTS = 3;

/**
 * Gemini 멀티모달 호출 실패를 나타내는 에러. 호출부에서 reason으로 분기할 수 있습니다.
 * - TIMEOUT: 응답 타임아웃
 * - NO_IMAGE: 응답에 이미지가 없음
 * - REQUEST_FAILED: 요청 자체 실패 (재시도 후에도 실패)
 */
export class GeminiApiError extends Error {
    constructor(
        readonly reason: 'TIMEOUT' | 'NO_IMAGE' | 'REQUEST_FAILED',
        readonly cause?: unknown,
    ) {
        super(`Gemini API 오류 (${reason})`);
        this.name = 'GeminiApiError';
    }
}

/** 생성된 이미지(base64)와 함께 모델이 반환한 텍스트(코디명 등). */
export type GeneratedImage = { data: string; mimeType: string; text: string };

/** 멀티모달 파트로 이미지 생성을 1회 호출하고, 타임아웃과 함께 결과를 추출한다. */
async function generateImageOnce(parts: object[]): Promise<GeneratedImage> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new GeminiApiError('TIMEOUT')), GEMINI_TIMEOUT_MS);
    });

    try {
        const response = await Promise.race([
            gemini.models.generateContent({
                model: GEMINI_IMAGE_MODEL,
                contents: [{ role: 'user', parts }],
                config: { responseModalities: ['IMAGE', 'TEXT'] },
            }),
            timeout,
        ]);

        const candidate = response.candidates?.[0];
        const responseParts = candidate?.content?.parts ?? [];
        const imagePart = responseParts.find((p: { inlineData?: unknown }) => p.inlineData);
        if (!imagePart?.inlineData) {
            // 이미지가 없으면 원인(안전필터 차단/거부 텍스트 등)을 로깅해 진단을 돕는다.
            const textOnly = responseParts
                .map((p: { text?: string }) => p.text)
                .filter((t): t is string => typeof t === 'string')
                .join(' ')
                .slice(0, 500);
            console.error('[Gemini] NO_IMAGE 진단:', {
                finishReason: candidate?.finishReason,
                blockReason: response.promptFeedback?.blockReason,
                safetyRatings: candidate?.safetyRatings,
                text: textOnly || '(텍스트 없음)',
            });
            throw new GeminiApiError('NO_IMAGE');
        }

        const { data, mimeType } = imagePart.inlineData as { data: string; mimeType?: string };
        const text = responseParts
            .map((p: { text?: string }) => p.text)
            .filter((t): t is string => typeof t === 'string')
            .join(' ');

        return { data, mimeType: mimeType ?? 'image/png', text };
    } finally {
        clearTimeout(timer);
    }
}



/**
 * 멀티모달 파트(텍스트 + 이미지)로 이미지 1장과 텍스트를 생성한다.
 * 타임아웃과 1회 재시도를 적용하며, 실패 시 GeminiApiError를 던진다. (HTTP 상태 매핑은 호출부 책임)
 * @param parts  Gemini contents의 parts 배열 (text / inlineData 혼합)
 */
export const generateMultimodalImage = async (parts: object[]): Promise<GeneratedImage> => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            return await generateImageOnce(parts);
        } catch (err) {
            lastError = err;
            console.error(`[Gemini] 이미지 생성 실패 (시도 ${attempt}/${MAX_ATTEMPTS}):`, err);
        }
    }
    throw lastError instanceof GeminiApiError ? lastError : new GeminiApiError('REQUEST_FAILED', lastError);
};

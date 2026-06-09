import { GoogleGenAI } from '@google/genai';
import { env } from '@/config/env';

export const gemini = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';
const GEMINI_TEXT_MODEL = 'gemini-2.5-flash';
/** 멀티모달 이미지 생성 응답 타임아웃 (응답 없이 멈춘 요청이 무한 대기하지 않도록) */
const GEMINI_TIMEOUT_MS = 60_000;
/** 텍스트 생성 타임아웃 (코디명 등 가벼운 호출용) */
const GEMINI_TEXT_TIMEOUT_MS = 15_000;
/** 최초 1회 + 실패 시 재시도 2회. 이미지 모델이 간헐적으로 이미지 없이 응답하는 것에 대비 */
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

/** 생성된 이미지(base64). */
export type GeneratedImage = { data: string; mimeType: string };

/**
 * 멀티모달 파트로 이미지 생성을 1회 호출하고, 타임아웃과 함께 이미지를 추출한다.
 * responseModalities를 IMAGE로 고정해 모델이 텍스트만 응답(이미지 누락)하는 것을 막는다.
 */
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
                config: { responseModalities: ['IMAGE'] },
            }),
            timeout,
        ]);

        const candidate = response.candidates?.[0];
        const responseParts = candidate?.content?.parts ?? [];
        const imagePart = responseParts.find((p: { inlineData?: unknown }) => p.inlineData);
        if (!imagePart?.inlineData) {
            // 이미지가 없으면 원인(안전필터 차단 등)을 로깅해 진단을 돕는다.
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
        return { data, mimeType: mimeType ?? 'image/png' };
    } finally {
        clearTimeout(timer);
    }
}

/**
 * 멀티모달 파트(텍스트 + 이미지)로 이미지 1장을 생성한다.
 * 타임아웃과 재시도를 적용하며, 실패 시 GeminiApiError를 던진다. (HTTP 상태 매핑은 호출부 책임)
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

/**
 * 텍스트 프롬프트로 짧은 텍스트를 생성한다 (코디명 등). 타임아웃 적용, 실패 시 throw.
 * 이미지 생성과 분리된 가벼운 호출이라 image 모델보다 비용이 훨씬 낮다.
 * @param prompt  생성 지시 텍스트
 */
export const generateText = async (prompt: string): Promise<string> => {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new GeminiApiError('TIMEOUT')), GEMINI_TEXT_TIMEOUT_MS);
    });

    try {
        const response = await Promise.race([
            gemini.models.generateContent({
                model: GEMINI_TEXT_MODEL,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
            }),
            timeout,
        ]);

        return (response.candidates?.[0]?.content?.parts ?? [])
            .map((p: { text?: string }) => p.text)
            .filter((t): t is string => typeof t === 'string')
            .join(' ')
            .trim();
    } finally {
        clearTimeout(timer);
    }
};

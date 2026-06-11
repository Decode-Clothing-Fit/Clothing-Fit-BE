import { GoogleGenAI, ApiError } from '@google/genai';
import { env } from '@/config/env';

// SDK 내부 재시도 횟수(기본 5). 503(모델 과부하)이 오면 SDK가 백오프 재시도를 반복하는데,
// 기본 5회면 우리 타임아웃(180초)까지 누적돼 503이 무응답(hang)처럼 보인다.
// 2로 낮춰(=1회 재시도) 일시적 blip은 흡수하되, 지속 503은 수초 내 표면화시켜 빠르게 실패시킨다.
const GEMINI_RETRY_ATTEMPTS = 2;

export const gemini = new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY,
    httpOptions: { retryOptions: { attempts: GEMINI_RETRY_ATTEMPTS } },
});

const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';
const GEMINI_TEXT_MODEL = 'gemini-2.5-flash';
/** 멀티모달 이미지 생성 응답 타임아웃 (응답 없이 멈춘 요청이 무한 대기하지 않도록). image-to-image 지연 편차가 커 180초로 둔다. */
const GEMINI_TIMEOUT_MS = 180_000;
/** 텍스트 생성 타임아웃 (코디명 등 가벼운 호출용) */
const GEMINI_TEXT_TIMEOUT_MS = 15_000;
/** 최초 1회 + 실패 시 재시도 2회. 이미지 모델이 간헐적으로 이미지 없이 응답하는 것에 대비 */
const MAX_ATTEMPTS = 3;

/**
 * Gemini 멀티모달 호출 실패를 나타내는 에러. 호출부에서 reason으로 분기할 수 있습니다.
 * - TIMEOUT: 응답 타임아웃
 * - OVERLOADED: 모델 측 일시 과부하(503)·레이트리밋(429) — 잠시 후 재시도하면 됨
 * - NO_IMAGE: 응답에 이미지가 없음
 * - REQUEST_FAILED: 요청 자체 실패 (재시도 후에도 실패)
 */
export class GeminiApiError extends Error {
    constructor(
        readonly reason: 'TIMEOUT' | 'OVERLOADED' | 'NO_IMAGE' | 'REQUEST_FAILED',
        readonly cause?: unknown,
    ) {
        super(`Gemini API 오류 (${reason})`);
        this.name = 'GeminiApiError';
    }
}

/** Google 측 일시 과부하(503)·레이트리밋(429)인지. 이 경우 재시도하지 않고 빠르게 실패시킨다. */
function isOverloadError(err: unknown): boolean {
    return err instanceof ApiError && (err.status === 503 || err.status === 429);
}

/** 생성된 이미지(base64). */
export type GeneratedImage = { data: string; mimeType: string };

/**
 * 멀티모달 파트로 이미지 생성을 1회 호출하고, 타임아웃과 함께 이미지를 추출한다.
 * responseModalities를 IMAGE로 고정해 모델이 텍스트만 응답(이미지 누락)하는 것을 막는다.
 */
/** 이미지 생성 호출 옵션. temperature/aspectRatio를 호출부(코디 소스 종류 등)에 따라 조절한다. */
export type ImageGenOptions = { aspectRatio?: string; temperature?: number };

const DEFAULT_IMAGE_TEMPERATURE = 0.2; // 색/디테일 재해석 억제 기본값

async function generateImageOnce(parts: object[], opts: ImageGenOptions = {}): Promise<GeneratedImage> {
    // 타임아웃 시 abort까지 걸어 실제 요청을 끊는다. (대기만 푸는 것을 넘어 SDK 내부 재시도/연결을 종료해
    //  동일 입력에 대한 백그라운드 중복 호출이 쌓이는 것을 막는다)
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            reject(new GeminiApiError('TIMEOUT'));
        }, GEMINI_TIMEOUT_MS);
    });

    try {
        const response = await Promise.race([
            gemini.models.generateContent({
                model: GEMINI_IMAGE_MODEL,
                contents: [{ role: 'user', parts }],
                // temperature를 낮추면 색/디테일 재해석은 줄지만 입력을 너무 그대로 두는 경향도 있어,
                // 호출부에서 소스에 맞게 조절한다(캐릭터=낮게/색보존, 업로드=조금 높게/옷 교체 자유도).
                // aspectRatio를 주면 출력 비율을 입력(인물 사진)에 맞춰 잘림(crop)을 방지한다.
                config: {
                    responseModalities: ['IMAGE'],
                    temperature: opts.temperature ?? DEFAULT_IMAGE_TEMPERATURE,
                    abortSignal: controller.signal,
                    ...(opts.aspectRatio ? { imageConfig: { aspectRatio: opts.aspectRatio } } : {}),
                },
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
 * 재시도는 "이미지 없이 응답(NO_IMAGE)"·일시적 요청 실패 대비용이며, 실패 시 GeminiApiError를 던진다.
 * 단, TIMEOUT은 재시도하지 않는다 — 무거운 호출이 타임아웃마다 누적돼 부하·비용이 커지는 것을 막기 위함.
 * (HTTP 상태 매핑은 호출부 책임)
 * @param parts  Gemini contents의 parts 배열 (text / inlineData 혼합)
 * @param opts   출력 종횡비(aspectRatio)·temperature 등 호출 옵션
 */
export const generateMultimodalImage = async (parts: object[], opts: ImageGenOptions = {}): Promise<GeneratedImage> => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            return await generateImageOnce(parts, opts);
        } catch (err) {
            lastError = err;
            console.error(`[Gemini] 이미지 생성 실패 (시도 ${attempt}/${MAX_ATTEMPTS}):`, err);
            // 타임아웃은 즉시 실패 처리 (재시도 시 중복 호출 누적 방지)
            if (err instanceof GeminiApiError && err.reason === 'TIMEOUT') break;
            // 모델 과부하(503)·레이트리밋(429)은 재시도해도 대개 무용 → 빠르게 OVERLOADED로 실패시킨다.
            if (isOverloadError(err)) {
                lastError = new GeminiApiError('OVERLOADED', err);
                break;
            }
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
    // 타임아웃 시 실제 요청도 abort해 백그라운드 호출이 계속되지 않게 한다.
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            reject(new GeminiApiError('TIMEOUT'));
        }, GEMINI_TEXT_TIMEOUT_MS);
    });

    try {
        const response = await Promise.race([
            gemini.models.generateContent({
                model: GEMINI_TEXT_MODEL,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: { abortSignal: controller.signal },
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

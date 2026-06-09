import sharp from 'sharp';
import { uuidv7 } from 'uuidv7';
import { Prisma, type ClothingType } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { meshFetch, MeshApiError } from '@/lib/ai/mesh';
import { generateMultimodalImage, generateText, GeminiApiError } from '@/lib/ai/gemini';
import { AppError } from '@/common/errors/app-error';
import { ErrorCode } from '@/common/errors/error-code';
import prisma from '@/lib/prisma/extensions';
import { uploadFittingModel, deleteFittingModel } from '@/lib/storage/fitting-model';
import { uploadClosetImage, deleteClosetImage } from '@/lib/storage/closet-image';
import { fittingStore, type FittingSession } from './fitting.store';
import type { CoordiMeasurements } from './fitting.schema';
import { CATEGORY_LABEL, CATEGORY_EN, buildCoordiPrompt, buildOutfitNamePrompt, parseOutfitName } from './fitting.prompt';
import { createFitCompleteNotification } from '../notifications/notifications.service';

const TTL_MS = 24 * 60 * 60 * 1000;
const POLL_INTERVAL_MS = 5000;
const RATE_LIMIT_BACKOFF_MS = 30_000; // Mesh AI 429 응답 시 대기
const MAX_CONCURRENT = 10;
const MAX_QUEUE_SIZE = 100;
const MAX_PER_USER = 1;

const MAX_ERROR_COUNT = 10;
const MAX_PROCESSING_MS = 30 * 60 * 1000;

/**
 * PROCESSING이 끝날 때 슬롯·사용자 카운트를 해제하고 다음 대기 작업을 시작합니다.
 * @params sessionId
 **/
function releaseSlot(sessionId: string): void {
    const session = fittingStore.getSession(sessionId);
    if (!session) return;
    fittingStore.decrementActive();
    fittingStore.decrementUserCount(session.userId);
    processQueue().catch((err) => console.error('[Fitting] processQueue error:', err));
}

/**
 * 세션을 삭제하면서 보유 중이던 슬롯·사용자 카운트를 상태에 맞게 해제합니다.
 * 모든 삭제 경로(만료 조회/큐 정리/TTL)가 이 함수를 통하게 하여 카운트 누수를 방지합니다.
 * @params sessionId
 **/
function cleanupSession(sessionId: string): void {
    const session = fittingStore.getSession(sessionId);
    if (!session) return;
    if (session.status === 'QUEUED' || session.status === 'PROCESSING') {
        fittingStore.decrementUserCount(session.userId);
    }
    if (session.status === 'PROCESSING') {
        fittingStore.decrementActive();
        processQueue().catch((err) => console.error('[Fitting] cleanup 후 processQueue 에러:', err));
    }
    fittingStore.deleteSession(sessionId);
}

/**
 * 대기열에 등록된 3D 피팅 작업을 처리합니다.
 * 사용 가능한 동시 처리 슬롯만큼 작업을 선점한 후 병렬로 Meshy 작업을 시작합니다.
 */
async function processQueue(): Promise<void> {
    const slots = MAX_CONCURRENT - fittingStore.getActiveCount();
    if (slots <= 0 || fittingStore.getQueueLength() === 0) return;

    const toStart: Array<{ sessionId: string; imageUrl: string }> = [];

    // 슬롯 예약을 동기로 처리해 race condition 방지
    while (toStart.length < slots && fittingStore.getQueueLength() > 0) {
        const nextSessionId = fittingStore.dequeue();
        if (!nextSessionId) break;

        const session = fittingStore.getSession(nextSessionId);
        if (!session || session.expiresAt < Date.now()) {
            // 큐에서 만료된 세션 정리 — 카운트 해제까지 한 번에 (누수 방지)
            cleanupSession(nextSessionId);
            continue;
        }

        fittingStore.incrementActive(); // await 이전에 슬롯 선점
        toStart.push({ sessionId: nextSessionId, imageUrl: session.imageUrl });
    }

    // 빈 슬롯만큼 병렬 시작
    await Promise.all(
        toStart.map(({ sessionId, imageUrl }) =>
            startMeshTask(sessionId, imageUrl).catch((err) =>
                console.error(`[Fitting] startMeshTask error for ${sessionId}:`, err),
            ),
        ),
    );
}

/**
 * Meshy 3D 생성 작업을 시작합니다.
 * 작업 ID를 세션에 저장하고 PROCESSING 상태로 전환한 뒤 상태 조회(Polling)를 예약합니다.
 * @params sessionId
 * @params imageUrl
 */
async function startMeshTask(sessionId: string, imageUrl: string): Promise<void> {
    // activeCount는 호출 전에 이미 증가됨
    const session = fittingStore.getSession(sessionId);
    if (!session) {
        fittingStore.decrementActive();
        return;
    }

    let meshData: { result?: string };
    try {
        const meshRes = await meshFetch('/image-to-3d', {
            method: 'POST',
            body: JSON.stringify({
                image_url: imageUrl,
                should_texture: true,
                enable_pbr: true,
                target_formats: ['glb'],
                // 품질 향상 옵션 (ai_model 업그레이드 없이 적용 가능)
                model_type: 'standard', // 고디테일 메시
                target_polycount: 50000, // 폴리곤 수 ↑ → 형태 디테일 ↑
                should_remesh: true,
                topology: 'quad', // 깔끔한 토폴로지
            }),
        });
        // .json() 파싱도 try 안에 둬야 본문이 비정상일 때 슬롯/카운트가 누수되지 않는다.
        meshData = (await meshRes.json()) as { result?: string };
    } catch (err) {
        // meshFetch는 non-2xx 응답에서 MeshApiError를 throw한다.
        console.error(`[Fitting] Mesh API 요청 실패 (${sessionId}):`, err);
        session.status = 'FAILED';
        fittingStore.setSession(sessionId, session);
        releaseSlot(sessionId);
        return;
    }

    if (!meshData.result) {
        console.error(`[Fitting] Mesh API task ID 없음 (${sessionId})`);
        session.status = 'FAILED';
        fittingStore.setSession(sessionId, session);
        releaseSlot(sessionId);
        return;
    }

    session.meshTaskId = meshData.result;
    session.status = 'PROCESSING';
    session.startedAt = Date.now();
    fittingStore.setSession(sessionId, session);
    // activeCount는 pollMeshStatus에서 작업 종료 시 감소
    setTimeout(() => pollMeshStatus(sessionId), POLL_INTERVAL_MS);
}

/**
 * 3D 피팅 세션을 조회하고 유효성·소유권을 검증합니다.
 * 존재하지 않거나 만료된 세션은 삭제 후 예외를 발생시키며,
 * 소유자가 아니면 존재 여부를 노출하지 않기 위해 동일하게 404를 던집니다.
 * @param sessionId
 * @param userId 소유권 검증 대상 사용자
 */
function getSession(sessionId: string, userId: string): FittingSession {
    const session = fittingStore.getSession(sessionId);
    if (!session || session.expiresAt < Date.now()) {
        // 만료 세션 삭제 시 보유 카운트도 함께 해제 (누수 방지)
        cleanupSession(sessionId);
        throw new AppError(ErrorCode.FITTING_NOT_FOUND, '세션을 찾을 수 없거나 만료되었습니다.', StatusCodes.NOT_FOUND);
    }
    if (session.userId !== userId) {
        throw new AppError(ErrorCode.FITTING_NOT_FOUND, '세션을 찾을 수 없거나 만료되었습니다.', StatusCodes.NOT_FOUND);
    }
    return session;
}

/**
 * Meshy 작업 상태를 주기적으로 조회하여
 * 진행률 및 결과 정보를 세션에 반영합니다.
 * @param sessionId
 */
async function pollMeshStatus(sessionId: string): Promise<void> {
    const session = fittingStore.getSession(sessionId);
    if (!session || session.expiresAt < Date.now() || session.status !== 'PROCESSING') return;

    if (Date.now() - (session.startedAt ?? 0) > MAX_PROCESSING_MS) {
        console.error(`[Fitting] 최대 처리 시간 초과 (${sessionId})`);
        session.status = 'FAILED';
        fittingStore.setSession(sessionId, session);
        releaseSlot(sessionId);
        return;
    }

    if (session.errorCount >= MAX_ERROR_COUNT) {
        console.error(`[Fitting] 최대 에러 횟수 초과 (${sessionId})`);
        session.status = 'FAILED';
        fittingStore.setSession(sessionId, session);
        releaseSlot(sessionId);
        return;
    }

    try {
        const meshRes = await meshFetch(`/image-to-3d/${session.meshTaskId}`);

        const meshData = (await meshRes.json()) as {
            status?: string;
            progress?: number;
            model_urls?: { glb?: string };
            thumbnail_url?: string;
        };

        if (!meshData.status) {
            console.error(`[Fitting] Mesh API 상태 없음 (${sessionId})`);
            session.status = 'FAILED';
            fittingStore.setSession(sessionId, session);
            releaseSlot(sessionId);
            return;
        }

        if (meshData.status === 'SUCCEEDED') {
            session.status = 'SUCCEEDED';
            session.glbUrl = meshData.model_urls?.glb;
            session.thumbnailUrl = meshData.thumbnail_url;
            fittingStore.setSession(sessionId, session);
            releaseSlot(sessionId);

            createFitCompleteNotification({
                receiverId: session.userId,
                dimension: '3D',
                closetArchiveId: session.closetArchiveId
            })
        } else if (meshData.status === 'FAILED' || meshData.status === 'EXPIRED') {
            session.status = 'FAILED';
            fittingStore.setSession(sessionId, session);
            releaseSlot(sessionId);
        } else {
            session.progress = meshData.progress;
            session.errorCount = 0;
            fittingStore.setSession(sessionId, session);
            setTimeout(() => pollMeshStatus(sessionId), POLL_INTERVAL_MS);
        }
    } catch (err) {
        // meshFetch는 non-2xx에서 MeshApiError를 throw한다.
        // 429(레이트리밋)는 에러 카운트 없이 더 긴 백오프 후 재시도한다.
        if (err instanceof MeshApiError && err.status === 429) {
            setTimeout(() => pollMeshStatus(sessionId), RATE_LIMIT_BACKOFF_MS);
            return;
        }

        console.error(`[Fitting] 폴링 에러 (${sessionId}):`, err);
        session.errorCount += 1;
        fittingStore.setSession(sessionId, session);
        setTimeout(() => pollMeshStatus(sessionId), POLL_INTERVAL_MS);
    }
}

/**
 * 3D 피팅 작업을 생성합니다.
 * 사용자별 요청 수를 제한하고 세션을 생성한 뒤 즉시 실행하거나 대기열에 등록합니다.
 * @param userId
 * @param closetArchiveId
 */
export const start3DFitting = async (userId: string, closetArchiveId: string): Promise<string> => {
    // 사용자당 동시 요청 제한 - await 이전에 선점해 race condition 방지
    if (fittingStore.getUserCount(userId) >= MAX_PER_USER) {
        throw new AppError(ErrorCode.FITTING_IN_PROGRESS, '이미 진행 중인 3D 피팅이 있습니다.', StatusCodes.CONFLICT);
    }
    fittingStore.incrementUserCount(userId);

    let archive: { imageUrl: string } | null;
    try {
        archive = await prisma.closetArchive.findFirst({
            where: { id: closetArchiveId, userId },
            select: { imageUrl: true },
        });
    } catch (err) {
        fittingStore.decrementUserCount(userId);
        throw err;
    }

    if (!archive) {
        fittingStore.decrementUserCount(userId);
        throw new AppError(ErrorCode.CLOSET_NOT_FOUND, '옷장 아카이브를 찾을 수 없습니다.', StatusCodes.NOT_FOUND);
    }

    const now = Date.now();
    const sessionId = uuidv7();

    fittingStore.setSession(sessionId, {
        userId,
        closetArchiveId,
        imageUrl: archive.imageUrl,
        status: 'QUEUED',
        expiresAt: now + TTL_MS,
        errorCount: 0,
    });

    // TTL 만료 시 정리 (카운트 해제 포함)
    setTimeout(() => cleanupSession(sessionId), TTL_MS);

    if (fittingStore.getActiveCount() < MAX_CONCURRENT) {
        fittingStore.incrementActive(); // await 이전에 슬롯 선점
        await startMeshTask(sessionId, archive.imageUrl);
    } else {
        if (fittingStore.getQueueLength() >= MAX_QUEUE_SIZE) {
            fittingStore.deleteSession(sessionId);
            fittingStore.decrementUserCount(userId);
            throw new AppError(ErrorCode.TOO_MANY_REQUESTS, '현재 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', StatusCodes.TOO_MANY_REQUESTS);
        }
        fittingStore.enqueue(sessionId);
    }

    return sessionId;
};

/**
 * 3D 피팅 작업의 현재 상태를 조회합니다.
 * 세션 소유권을 검증한 후 진행 상태와 결과 정보를 반환합니다.
 * @param userId
 * @param sessionId
 */
export const get3DFittingStatus = (userId: string, sessionId: string) => {
    const session = getSession(sessionId, userId);

    return {
        status: session.status,
        progress: session.progress,
        glbUrl: session.glbUrl ?? null,
        thumbnailUrl: session.thumbnailUrl ?? null,
    };
};

/**
 * 3D 피팅 결과(옷장 아카이브)의 제목을 변경합니다.
 * 소유권을 쿼리에 포함해(id + userId), 본인 소유가 아니거나 없으면 404를 반환합니다.
 * @param userId
 * @param closetArchiveId
 * @param titleInput
 */
export const updateFittingTitle = async (userId: string, closetArchiveId: string, titleInput: string): Promise<void> => {
    const { count } = await prisma.closetArchive.updateMany({
        where: { id: closetArchiveId, userId },
        data: { title: titleInput },
    });

    if (count === 0) {
        throw new AppError(ErrorCode.CLOSET_NOT_FOUND, '옷장 아카이브를 찾을 수 없습니다.', StatusCodes.NOT_FOUND);
    }
};

/**
 * Meshy가 내려준 glb를 우리 S3에 업로드한 뒤, closet_archive.model_url에 그 링크를 저장합니다.
 * @param userId
 * @param sessionId 저장할 피팅 세션 ID
 */
export const updateFittingModel = async (userId: string, sessionId: string): Promise<{ modelUrl: string }> => {
    const session = getSession(sessionId, userId);

    // 저장 가능한 상태(완료 + glb 존재) 확인
    if (session.status !== 'SUCCEEDED' || !session.glbUrl) {
        throw new AppError(ErrorCode.FITTING_IN_PROGRESS, '저장할 수 있는 3D 피팅 결과가 없습니다.', StatusCodes.CONFLICT);
    }

    // 업로드 전에 대상 아카이브 소유권/존재 확인 + 이전 model_url 확보 (orphan 방지)
    const archive = await prisma.closetArchive.findFirst({
        where: { id: session.closetArchiveId, userId },
        select: { modelUrl: true },
    });
    if (!archive) {
        throw new AppError(ErrorCode.CLOSET_NOT_FOUND, '옷장 아카이브를 찾을 수 없습니다.', StatusCodes.NOT_FOUND);
    }

    // Meshy glb 다운로드 → 우리 S3 업로드 (실패는 만료/업스트림 문제이므로 502로 매핑)
    let modelUrl: string;
    try {
        modelUrl = await uploadFittingModel(userId, session.glbUrl);
    } catch (err) {
        console.error(`[Fitting] glb 저장 실패 (${sessionId}):`, err);
        throw new AppError(ErrorCode.MESHY_API_ERROR, '3D 결과를 가져오지 못했습니다. (결과 링크가 만료되었을 수 있습니다)', StatusCodes.BAD_GATEWAY);
    }

    // closet_archive.model_url 저장 (소유권은 위 findFirst에서 검증됨)
    try {
        await prisma.closetArchive.update({
            where: { id: session.closetArchiveId },
            data: { modelUrl },
        });
    } catch (err) {
        // DB 반영 실패 시 방금 업로드한 객체 보상 삭제
        await deleteFittingModel(modelUrl);
        // 조회~수정 사이에 아카이브가 삭제된 경우(P2025)는 404로 매핑
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            throw new AppError(ErrorCode.CLOSET_NOT_FOUND, '옷장 아카이브를 찾을 수 없습니다.', StatusCodes.NOT_FOUND);
        }
        throw err;
    }

    // 저장 성공 후 이전 모델 객체 정리 (재저장 시 orphan 방지)
    await deleteFittingModel(archive.modelUrl);

    return { modelUrl };
};

// ───────────────────────────── 2D 코디 생성 (Gemini) ─────────────────────────────
// 프롬프트 구성/파싱(순수 함수)은 ./fitting.prompt 로 분리되어 있다.

/** 코디 생성에 사용할 의류 1건 (캡처 이미지 + 메타데이터). measurements는 선택 사이즈 기준 납작한 치수다. */
type CoordiGarment = {
    category: ClothingType;
    image: Express.Multer.File;
    measurements: CoordiMeasurements;
    selectedSize?: string;
    brand: string;
    name: string;
    sourceUrl?: string;
};

/** 코디명 생성 프롬프트에 넘길 상품 표시명 ("브랜드 상품명"). 저장은 brand/name을 컬럼별로 따로 한다. */
function garmentDisplayName(g: CoordiGarment): string {
    return `${g.brand} ${g.name}`;
}

const AVATAR_FETCH_TIMEOUT_MS = 10_000; // 아바타 이미지가 무응답일 때 무한 대기 방지
const RESIZE_MAX_DIMENSION = 1024; // 의류 디테일(패턴·로고) 보존을 위해 입력 해상도 상향

/**
 * 업로드 이미지를 멀티모달 요청에 적합한 크기로 줄여 base64로 변환한다.
 * 색이 임의로 틀어지는 것을 막기 위해 JPEG 재압축 대신 무손실 PNG로 인코딩한다.
 */
async function toResizedBase64(buffer: Buffer): Promise<string> {
    return (
        await sharp(buffer)
            .resize(RESIZE_MAX_DIMENSION, RESIZE_MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
            .png()
            .toBuffer()
    ).toString('base64');
}

type CoordiContext = {
    avatarUrl: string;
    gender: string;
    height: number | null;
    weight: number | null;
    dbMeasurements: Record<string, number>;
};

/** 의류별 필수 치수를 검증한다. (measurements는 선택 사이즈 기준 납작한 치수) */
function validateGarments(garments: CoordiGarment[]): void {
    if (garments.length === 0) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, '의류가 최소 1개 필요합니다.', StatusCodes.BAD_REQUEST);
    }
    for (const g of garments) {
        if (Object.keys(g.measurements).length === 0) {
            throw new AppError(ErrorCode.VALIDATION_ERROR, `${CATEGORY_LABEL[g.category]} 치수 데이터가 필요합니다.`, StatusCodes.BAD_REQUEST);
        }
    }
}

/** 코디 생성에 필요한 아바타 URL과 신체/성별 정보를 조회한다. 아바타가 없으면 404. */
async function loadCoordiContext(userId: string): Promise<CoordiContext> {
    const [userCharacter, bodyInfo, profile] = await Promise.all([
        prisma.userCharacter.findUnique({
            where: { userId },
            select: { imageUrl: true, character: { select: { imageUrl: true } } },
        }),
        prisma.bodyInfo.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: { height: true, weight: true, measurements: true },
        }),
        prisma.profile.findUnique({ where: { userId }, select: { gender: true } }),
    ]);

    const avatarUrl = userCharacter?.imageUrl ?? userCharacter?.character?.imageUrl;
    if (!avatarUrl) {
        throw new AppError(ErrorCode.FITTING_FAILED, '아바타 정보가 없습니다.', StatusCodes.NOT_FOUND);
    }

    const dbMeasurements =
        bodyInfo?.measurements && typeof bodyInfo.measurements === 'object' && !Array.isArray(bodyInfo.measurements)
            ? (bodyInfo.measurements as Record<string, number>)
            : {};

    return {
        avatarUrl,
        gender: profile?.gender ?? '미제공',
        height: bodyInfo?.height ?? null,
        weight: bodyInfo?.weight ?? null,
        dbMeasurements,
    };
}

/** 아바타(타임아웃 fetch)와 의류 이미지를 리사이즈해 Gemini 멀티모달 parts를 만든다. */
async function buildCoordiParts(avatarUrl: string, garments: CoordiGarment[], prompt: string): Promise<object[]> {
    let avatarResponse: Response;
    try {
        avatarResponse = await fetch(avatarUrl, { signal: AbortSignal.timeout(AVATAR_FETCH_TIMEOUT_MS) });
    } catch (err) {
        const timedOut = err instanceof Error && err.name === 'TimeoutError';
        throw new AppError(
            ErrorCode.FITTING_FAILED,
            timedOut ? '아바타 이미지 로딩 시간이 초과되었습니다.' : '아바타 이미지를 불러올 수 없습니다.',
            StatusCodes.BAD_GATEWAY,
        );
    }
    if (!avatarResponse.ok) {
        throw new AppError(ErrorCode.FITTING_FAILED, '아바타 이미지를 불러올 수 없습니다.', StatusCodes.BAD_GATEWAY);
    }

    const [avatarData, garmentData] = await Promise.all([
        toResizedBase64(Buffer.from(await avatarResponse.arrayBuffer())),
        Promise.all(garments.map((g) => toResizedBase64(g.image.buffer))),
    ]);

    return [
        { text: 'Image 1 — avatar:' },
        { inlineData: { mimeType: 'image/png', data: avatarData } },
        ...garments.flatMap((g, i) => [
            { text: `Image ${i + 2} — ${CATEGORY_EN[g.category]}:` },
            { inlineData: { mimeType: 'image/png', data: garmentData[i] } },
        ]),
        { text: prompt },
    ];
}

/** Gemini 이미지 생성 호출. 전송 디테일은 lib/ai/gemini가 담당하고, 여기서는 실패 reason을 HTTP 상태로 매핑한다. */
async function runGemini(parts: object[]): Promise<{ data: string; mimeType: string }> {
    try {
        return await generateMultimodalImage(parts);
    } catch (err) {
        if (err instanceof GeminiApiError && err.reason === 'TIMEOUT') {
            throw new AppError(ErrorCode.GEMINI_API_ERROR, 'Gemini 응답 타임아웃', StatusCodes.GATEWAY_TIMEOUT);
        }
        throw new AppError(ErrorCode.GEMINI_API_ERROR, '코디 이미지 생성에 실패했습니다.', StatusCodes.BAD_GATEWAY);
    }
}

/**
 * 코디명을 텍스트 모델로 별도 생성한다 (이미지 생성과 분리해 이미지 누락을 방지).
 * 실패해도 코디 자체는 성공해야 하므로, 에러 시 기본값으로 폴백한다.
 */
async function generateOutfitName(garments: CoordiGarment[]): Promise<string> {
    try {
        const text = await generateText(
            buildOutfitNamePrompt(garments.map((g) => ({ category: g.category, title: garmentDisplayName(g) }))),
        );
        return parseOutfitName(text);
    } catch (err) {
        console.error('[Coordi] 코디명 생성 실패, 기본값 사용:', err);
        return parseOutfitName(''); // 빈 입력 → 기본 코디명
    }
}

/**
 * 코디 결과 + 각 캡처 의류 이미지를 S3에 올린다.
 * 부분 실패 시 성공분을 보상 삭제하고 throw하여 orphan을 막는다.
 * 반환: [코디 이미지, ...garments와 동일 순서의 의류 이미지]
 */
async function uploadCoordiImages(
    userId: string,
    coordiBuffer: Buffer,
    coordiContentType: string,
    garments: CoordiGarment[],
): Promise<{ coordiImageUrl: string; clothingImageUrls: string[] }> {
    const settled = await Promise.allSettled([
        uploadClosetImage(userId, coordiBuffer, coordiContentType, 'coordi'),
        ...garments.map((g) => uploadClosetImage(userId, g.image.buffer, g.image.mimetype || 'image/jpeg', 'clothing')),
    ]);

    const uploadedUrls = settled
        .filter((s): s is PromiseFulfilledResult<string> => s.status === 'fulfilled')
        .map((s) => s.value);
    const rejected = settled.filter((s): s is PromiseRejectedResult => s.status === 'rejected');

    if (rejected.length > 0) {
        await Promise.all(uploadedUrls.map(deleteClosetImage));
        console.error('[Coordi] 이미지 업로드 실패:', rejected.map((r) => r.reason));
        throw new AppError(ErrorCode.FITTING_FAILED, '코디 이미지 저장에 실패했습니다.', StatusCodes.BAD_GATEWAY);
    }

    return { coordiImageUrl: uploadedUrls[0], clothingImageUrls: uploadedUrls.slice(1) };
}

/** closet_archive + closet_items 저장. 실패 시 업로드된 S3 객체를 보상 삭제하고 throw. */
async function persistCoordi(
    userId: string,
    params: {
        coordiImageUrl: string;
        clothingImageUrls: string[];
        outfitName: string;
        height: number | null;
        weight: number | null;
        garments: CoordiGarment[];
    },
): Promise<string> {
    const { coordiImageUrl, clothingImageUrls, outfitName, height, weight, garments } = params;
    try {
        const archive = await prisma.closetArchive.create({
            data: {
                userId,
                imageUrl: coordiImageUrl,
                title: outfitName,
                bodyInfo: { height, weight }, // body_info에는 신체 정보만 기록
                closetItems: {
                    create: garments.map((g, i) => ({
                        brand: g.brand,
                        name: g.name,
                        imageUrl: clothingImageUrls[i],
                        externalLink: g.sourceUrl ?? null,
                        type: g.category,
                        size: g.selectedSize ?? null,
                    })),
                },
            },
            select: { id: true },
        });
        return archive.id;
    } catch (err) {
        // DB 저장 실패 시 방금 업로드한 S3 객체 보상 삭제 (orphan 방지)
        await Promise.all([coordiImageUrl, ...clothingImageUrls].map(deleteClosetImage));
        console.error('[Coordi] 옷장 아카이브 저장 실패:', err);
        throw new AppError(ErrorCode.FITTING_FAILED, '코디 저장에 실패했습니다.', StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

/**
 * 2D 코디 이미지를 생성하고 옷장 아카이브에 저장한다.
 * 검증 → 컨텍스트 조회 → 프롬프트/파트 구성 → Gemini 생성 → S3 업로드 → DB 저장.
 * 각 단계의 디테일(타임아웃/보상삭제/HTTP 매핑)은 헬퍼가 담당한다.
 * @param userId
 * @param garments  카테고리 순서로 들어오는 의류(이미지 + 치수 + 상품 정보). 최대 5개.
 */
export const generateCoordi = async (
    userId: string,
    garments: CoordiGarment[],
): Promise<{ closetArchiveId: string; imageUrl: string; outfitName: string }> => {
    validateGarments(garments);

    const ctx = await loadCoordiContext(userId);

    const prompt = buildCoordiPrompt({
        gender: ctx.gender,
        height: ctx.height,
        weight: ctx.weight,
        bodyMeasurements: ctx.dbMeasurements,
        garments,
    });
    const parts = await buildCoordiParts(ctx.avatarUrl, garments, prompt);

    // 이미지(image 모델)와 코디명(text 모델)을 분리·병렬 실행. 코디명은 실패해도 기본값으로 폴백된다.
    const [generated, outfitName] = await Promise.all([
        runGemini(parts),
        generateOutfitName(garments),
    ]);

    const coordiBuffer = Buffer.from(generated.data, 'base64');
    const coordiContentType = generated.mimeType.startsWith('image/') ? generated.mimeType : 'image/png';
    const { coordiImageUrl, clothingImageUrls } = await uploadCoordiImages(userId, coordiBuffer, coordiContentType, garments);

    const closetArchiveId = await persistCoordi(userId, {
        coordiImageUrl,
        clothingImageUrls,
        outfitName,
        height: ctx.height,
        weight: ctx.weight,
        garments,
    });

    return { closetArchiveId, imageUrl: coordiImageUrl, outfitName };
};
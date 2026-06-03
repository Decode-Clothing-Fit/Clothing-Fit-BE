import { uuidv7 } from 'uuidv7';
import { meshFetch, MeshApiError } from '@/lib/ai/mesh';
import { AppError } from '@/common/errors/app-error';
import { ErrorCode } from '@/common/errors/error-code';
import prisma from '@/lib/prisma/extensions';
import { fittingStore, type FittingSession } from './fitting.store';

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
            // 큐에서 만료된 세션을 정리할 때 사용자 카운트도 해제해야
            // TTL 핸들러가 세션을 못 찾아 카운트가 영구히 남는 누수를 막는다.
            if (session) fittingStore.decrementUserCount(session.userId);
            fittingStore.deleteSession(nextSessionId);
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
 * 3D 피팅 세션을 조회하고 유효성을 검사합니다.
 * 존재하지 않거나 만료된 세션은 삭제 후 예외를 발생시킵니다.
 * @params sessionId
 */
function getSession(sessionId: string): FittingSession {
    const session = fittingStore.getSession(sessionId);
    if (!session || session.expiresAt < Date.now()) {
        fittingStore.deleteSession(sessionId);
        throw new AppError(ErrorCode.FITTING_NOT_FOUND, '세션을 찾을 수 없거나 만료되었습니다.', 404);
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
        throw new AppError(ErrorCode.FITTING_IN_PROGRESS, '이미 진행 중인 3D 피팅이 있습니다.', 409);
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
        throw new AppError(ErrorCode.CLOSET_NOT_FOUND, '옷장 아카이브를 찾을 수 없습니다.', 404);
    }

    const now = Date.now();
    const sessionId = uuidv7();

    fittingStore.setSession(sessionId, {
        userId,
        imageUrl: archive.imageUrl,
        status: 'QUEUED',
        expiresAt: now + TTL_MS,
        errorCount: 0,
    });

    // TTL 만료 시 정리 (QUEUED/PROCESSING 상태인 경우만 카운트 감소)
    setTimeout(() => {
        const s = fittingStore.getSession(sessionId);
        if (s) {
            if (s.status === 'QUEUED' || s.status === 'PROCESSING') {
                fittingStore.decrementUserCount(s.userId);
            }
            if (s.status === 'PROCESSING') {
                fittingStore.decrementActive();
                processQueue().catch((err) => console.error('[Fitting] TTL 후 processQueue 에러:', err));
            }
        }
        fittingStore.deleteSession(sessionId);
    }, TTL_MS);

    if (fittingStore.getActiveCount() < MAX_CONCURRENT) {
        fittingStore.incrementActive(); // await 이전에 슬롯 선점
        await startMeshTask(sessionId, archive.imageUrl);
    } else {
        if (fittingStore.getQueueLength() >= MAX_QUEUE_SIZE) {
            fittingStore.deleteSession(sessionId);
            fittingStore.decrementUserCount(userId);
            throw new AppError(ErrorCode.TOO_MANY_REQUESTS, '현재 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 429);
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
    const session = getSession(sessionId);

    // 소유권 검증: 다른 사용자의 세션 조회 차단 (존재 여부 비노출 위해 404 사용)
    if (session.userId !== userId) {
        throw new AppError(ErrorCode.FITTING_NOT_FOUND, '세션을 찾을 수 없거나 만료되었습니다.', 404);
    }

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
        throw new AppError(ErrorCode.CLOSET_NOT_FOUND, '옷장 아카이브를 찾을 수 없습니다.', 404);
    }
};
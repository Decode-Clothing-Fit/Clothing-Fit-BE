// Redis 등으로 교체할 때 이 인터페이스만 구현하면 됩니다.

export type FittingStatus = 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';

export type FittingSession = {
    userId: string;
    closetArchiveId: string;
    meshTaskId?: string;
    imageUrl: string;
    status: FittingStatus;
    progress?: number;
    glbUrl?: string;
    thumbnailUrl?: string;
    startedAt?: number;
    expiresAt: number;
    errorCount: number;
};

/** 2D 코디 생성 결과 (멱등성 캐시에 저장하는 응답 본문). */
export type CoordiResult = { closetArchiveId: string; imageUrl: string; outfitName: string };

/**
 * 2D 코디 멱등성 레코드. 같은 Idempotency-Key 재요청을 식별한다.
 * - pending: 처리 중 (동시 중복 요청은 409로 거부)
 * - done: 완료 (동일 키 재요청에 캐시된 결과를 그대로 반환)
 */
export type CoordiIdempotencyRecord =
    | { status: 'pending'; expiresAt: number }
    | { status: 'done'; result: CoordiResult; expiresAt: number };

export interface IFittingStore {
    // 세션
    getSession(id: string): FittingSession | undefined;
    setSession(id: string, session: FittingSession): void;
    deleteSession(id: string): void;

    // 대기열
    enqueue(sessionId: string): void;
    dequeue(): string | undefined;
    getQueueLength(): number;

    // 전체 활성 작업 수 (Mesh AI 동시 작업 제한)
    getActiveCount(): number;
    incrementActive(): void;
    decrementActive(): void;

    // 사용자별 활성 3D 세션 수 (중복 요청 방지)
    getUserCount(userId: string): number;
    incrementUserCount(userId: string): void;
    decrementUserCount(userId: string): void;

    // 사용자별 진행 중 2D 코디 생성 수 (동시성 제한)
    getCoordiCount(userId: string): number;
    incrementCoordiCount(userId: string): void;
    decrementCoordiCount(userId: string): void;

    // 2D 코디 멱등성 캐시 (key = `${userId}:${idempotencyKey}`)
    getIdempotency(key: string): CoordiIdempotencyRecord | undefined;
    setIdempotency(key: string, record: CoordiIdempotencyRecord): void;
    deleteIdempotency(key: string): void;
}

class InMemoryFittingStore implements IFittingStore {
    private sessions = new Map<string, FittingSession>();
    private queue: string[] = [];
    private activeCount = 0;
    private userCounts = new Map<string, number>();
    private coordiCounts = new Map<string, number>();
    private idempotency = new Map<string, CoordiIdempotencyRecord>();

    getSession(id: string) { return this.sessions.get(id); }
    setSession(id: string, session: FittingSession) { this.sessions.set(id, session); }
    deleteSession(id: string) { this.sessions.delete(id); }

    enqueue(sessionId: string) { this.queue.push(sessionId); }
    dequeue() { return this.queue.shift(); }
    getQueueLength() { return this.queue.length; }

    getActiveCount() { return this.activeCount; }
    incrementActive() { this.activeCount++; }
    decrementActive() { if (this.activeCount > 0) this.activeCount--; }

    getUserCount(userId: string) { return this.userCounts.get(userId) ?? 0; }
    incrementUserCount(userId: string) {
        this.userCounts.set(userId, this.getUserCount(userId) + 1);
    }
    decrementUserCount(userId: string) {
        const count = this.getUserCount(userId);
        if (count <= 1) this.userCounts.delete(userId);
        else this.userCounts.set(userId, count - 1);
    }

    getCoordiCount(userId: string) { return this.coordiCounts.get(userId) ?? 0; }
    incrementCoordiCount(userId: string) {
        this.coordiCounts.set(userId, this.getCoordiCount(userId) + 1);
    }
    decrementCoordiCount(userId: string) {
        const count = this.getCoordiCount(userId);
        if (count <= 1) this.coordiCounts.delete(userId);
        else this.coordiCounts.set(userId, count - 1);
    }

    getIdempotency(key: string) { return this.idempotency.get(key); }
    setIdempotency(key: string, record: CoordiIdempotencyRecord) { this.idempotency.set(key, record); }
    deleteIdempotency(key: string) { this.idempotency.delete(key); }
}

export const fittingStore: IFittingStore = new InMemoryFittingStore();

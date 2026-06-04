// Redis 등으로 교체할 때 이 인터페이스만 구현하면 됩니다.

export type FittingStatus = 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';

export type FittingSession = {
    userId: string;
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

    // 사용자별 활성 세션 수 (중복 요청 방지)
    getUserCount(userId: string): number;
    incrementUserCount(userId: string): void;
    decrementUserCount(userId: string): void;
}

class InMemoryFittingStore implements IFittingStore {
    private sessions = new Map<string, FittingSession>();
    private queue: string[] = [];
    private activeCount = 0;
    private userCounts = new Map<string, number>();

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
}

export const fittingStore: IFittingStore = new InMemoryFittingStore();

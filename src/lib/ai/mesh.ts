import { env } from '@/config/env';

const MESH_BASE_URL = 'https://api.meshy.ai/openapi/v1';

/** Mesh AI가 non-2xx를 반환했을 때 던지는 에러. 호출부에서 status로 분기할 수 있습니다. */
export class MeshApiError extends Error {
    constructor(
        readonly status: number,
        readonly body: unknown,
    ) {
        super(`Mesh API 오류 (${status}): ${JSON.stringify(body)}`);
        this.name = 'MeshApiError';
    }
}

export const meshFetch = async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`${MESH_BASE_URL}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${env.MESHY_API_KEY}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new MeshApiError(response.status, error);
    }

    return response;
};

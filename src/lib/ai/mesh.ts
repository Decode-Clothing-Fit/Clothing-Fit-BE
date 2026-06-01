import { env } from '@/config/env';

const MESH_BASE_URL = 'https://api.meshy.ai/openapi/v1';

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
        const error = await response.json();
        throw new Error(`Mesh API 오류 (${response.status}): ${JSON.stringify(error)}`);
    }

    return response;
};

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const Fitting3DRequestSchema = z
    .object({
        closetArchiveId: z.string().uuid().openapi({ description: '2D 피팅 이미지가 저장된 옷장 아카이브 ID', example: '01968b1c-...' }),
    })
    .openapi('Fitting3DRequest');

export const Fitting3DStartResponseSchema = z
    .object({
        message: z.string().openapi({ example: '3D 피팅 생성 시작' }),
        data: z.object({
            sessionId: z.string().openapi({ description: '상태 조회에 사용할 세션 ID (24시간 유효)', example: '01968b1c-...' }),
        }),
    })
    .openapi('Fitting3DStartResponse');

export const Fitting3DStatusResponseSchema = z
    .object({
        message: z.string().openapi({ example: '3D 피팅 생성 완료' }),
        data: z.object({
            status: z.enum(['QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED']).openapi({ example: 'SUCCEEDED' }),
            progress: z.number().optional().openapi({ example: 80 }),
            glbUrl: z.string().url().nullable().openapi({ example: 'https://assets.meshy.ai/...glb' }),
            thumbnailUrl: z.string().url().nullable().openapi({ example: 'https://assets.meshy.ai/...png' }),
        }),
    })
    .openapi('Fitting3DStatusResponse');

export const SessionIdParamSchema = z
    .object({
        sessionId: z.string().openapi({ example: '01968b1c-...' }),
    })
    .openapi('SessionIdParam');

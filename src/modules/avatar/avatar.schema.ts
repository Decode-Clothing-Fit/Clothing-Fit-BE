import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const UserAvatarResponseSchema = z
    .object({
        data: z.object({
            imageUrl: z.string().url().openapi({ description: '아바타 이미지 URL', example: 'https://assets.example.com/avatar.png' }),
        }),
    })
    .openapi('UserAvatarResponse');

export const UserAvatarRequestSchema = z
    .object({
        characterId: z.string().uuid().openapi({ description: '변경할 캐릭터 ID', example: '01968b1c-...' }),
    })
    .openapi('UpdateAvatarRequest');

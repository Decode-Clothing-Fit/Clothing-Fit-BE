import { registry } from '@/config/registry';
import { ErrorResponseSchema } from '@/common/schemas/api.schema';
import { UserAvatarResponseSchema } from './avatar.schema';

registry.registerPath({
    method: 'get',
    path: '/avatar',
    tags: ['Avatar'],
    summary: '사용자 아바타 조회',
    description:
        '로그인한 사용자의 아바타 이미지를 조회합니다. ' +
        '업로드한 사진이 있으면 사진을, 없으면 선택한 캐릭터의 이미지를 반환합니다.',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: '아바타 조회 성공',
            content: { 'application/json': { schema: UserAvatarResponseSchema } },
        },
        401: {
            description: '인증 필요',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        404: {
            description: '아바타 또는 아바타 이미지를 찾을 수 없음',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
    },
});

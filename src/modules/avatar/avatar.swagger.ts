import { registry } from '@/config/registry';
import { ErrorResponseSchema } from '@/common/schemas/api.schema';
import { UserAvatarResponseSchema, UserAvatarRequestSchema } from './avatar.schema';

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

registry.registerPath({
    method: 'patch',
    path: '/avatar/image',
    tags: ['Avatar'],
    summary: '사용자 아바타 사진 설정 (온보딩/변경 공용)',
    description:
        '사용자가 업로드한 이미지로 아바타를 설정합니다. 최초 설정·변경 모두 처리합니다(upsert). ' +
        '이미지는 검증·정규화 후 S3에 저장되며, 캐릭터 연결은 해제되고 설정된 이미지 URL을 반환합니다.',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'multipart/form-data': {
                    schema: {
                        type: 'object',
                        properties: {
                            image: { type: 'string', format: 'binary', description: '업로드할 이미지 파일 (png/jpeg/webp, 최대 5MB)' },
                        },
                        required: ['image'],
                    },
                },
            },
        },
    },
    responses: {
        200: {
            description: '아바타 설정 성공',
            content: { 'application/json': { schema: UserAvatarResponseSchema } },
        },
        400: {
            description: '이미지 파일 누락 또는 형식 오류 (png/jpeg/webp 아님, 위장 파일 등)',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        401: {
            description: '인증 필요',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        413: {
            description: '이미지 용량 초과 (최대 5MB)',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
    },
});

registry.registerPath({
    method: 'patch',
    path: '/avatar',
    tags: ['Avatar'],
    summary: '사용자 아바타 캐릭터 설정 (온보딩/변경 공용)',
    description:
        '로그인한 사용자의 아바타를 지정한 캐릭터로 설정합니다. 최초 설정·변경 모두 처리합니다(upsert). ' +
        '캐릭터로 전환되며 기존 업로드 이미지는 제거·정리되고, 설정된 아바타 이미지를 반환합니다.',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: UserAvatarRequestSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: '아바타 변경 성공',
            content: { 'application/json': { schema: UserAvatarResponseSchema } },
        },
        400: {
            description: '유효하지 않은 요청 (characterId 형식 오류)',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        401: {
            description: '인증 필요',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        404: {
            description: '존재하지 않는 캐릭터',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
    },
});

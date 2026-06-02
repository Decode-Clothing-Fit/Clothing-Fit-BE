import { registry } from '@/config/registry';
import { ErrorResponseSchema } from '@/common/schemas/api.schema';
import { Fitting3DRequestSchema, Fitting3DStartResponseSchema, Fitting3DStatusResponseSchema, SessionIdParamSchema } from './fitting.schema';

registry.registerPath({
    method: 'post',
    path: '/fitting/3d',
    tags: ['Fitting'],
    summary: '3D 피팅 생성 시작',
    description:
        'closet_archive에 저장된 이미지를 Mesh AI로 전달해 3D 모델 변환을 시작합니다. ' +
        '사용자당 동시에 1개의 요청만 허용되며, 이미 진행 중인 작업이 있으면 409를 반환합니다. ' +
        '동시 작업이 10개를 초과하면 즉시 QUEUED 상태의 sessionId를 반환하며, 슬롯이 생기면 자동으로 처리됩니다. ' +
        '클라이언트는 반환된 sessionId로 GET /fitting/:sessionId를 폴링해 진행 상태를 확인하면 됩니다. ' +
        '세션은 24시간 유효합니다.',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: Fitting3DRequestSchema,
                },
            },
        },
    },
    responses: {
        202: {
            description: '3D 피팅 시작됨 (PROCESSING) 또는 대기열 등록됨 (QUEUED)',
            content: { 'application/json': { schema: Fitting3DStartResponseSchema } },
        },
        400: {
            description: '유효하지 않은 요청 (closetArchiveId 형식 오류)',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        401: {
            description: '인증 필요',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        404: {
            description: '옷장 아카이브를 찾을 수 없음',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        409: {
            description: '이미 진행 중인 3D 피팅이 있음 (사용자당 1개 제한)',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        429: {
            description: '대기열 초과 (동시 요청이 너무 많음)',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        502: {
            description: 'Mesh AI 오류',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/fitting/{sessionId}',
    tags: ['Fitting'],
    summary: '3D 피팅 상태 조회',
    description:
        '3D 피팅 생성 상태를 조회합니다.\n\n' +
        '**status 값 설명**\n' +
        '- `QUEUED`: 동시 작업 한도(10개) 초과로 대기 중. 슬롯이 생기면 자동으로 PROCESSING 전환\n' +
        '- `PROCESSING`: Mesh AI가 3D 변환 중. `progress` 필드로 진행률(0~100) 확인 가능\n' +
        '- `SUCCEEDED`: 변환 완료. `glbUrl`로 3D 모델, `thumbnailUrl`로 썸네일 사용 가능\n' +
        '- `FAILED`: 변환 실패 (Mesh AI 오류, 30분 초과, 연속 에러 10회 초과)\n\n' +
        '세션 만료(24시간) 또는 서버 재시작 시 404가 반환됩니다.',
    security: [{ bearerAuth: [] }],
    request: {
        params: SessionIdParamSchema,
    },
    responses: {
        200: {
            description: '상태 조회 성공',
            content: { 'application/json': { schema: Fitting3DStatusResponseSchema } },
        },
        401: {
            description: '인증 필요',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        404: {
            description: '세션 없음 또는 만료',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        500: {
            description: '서버 내부 오류',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
    },
});

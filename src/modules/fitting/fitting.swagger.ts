import { registry } from '@/config/registry';
import { ErrorResponseSchema } from '@/common/schemas/api.schema';
import {
    Fitting3DRequestSchema,
    Fitting3DStartResponseSchema,
    Fitting3DStatusResponseSchema,
    SessionIdParamSchema,
    FittingTitleParamSchema,
    FittingTitleBodySchema,
    UpdateFittingModelResponseSchema,
    GenerateCoordiRequestSchema,
    GenerateCoordiResponseSchema,
} from './fitting.schema';

registry.registerPath({
    method: 'post',
    path: '/fitting/2d',
    tags: ['Fitting'],
    summary: '2D 코디 생성',
    description:
        'multipart/form-data로 의류 이미지(최대 5개)와 `meta` JSON을 함께 보냅니다. ' +
        '`meta`는 `{ "items": [...] }` 형태이며, 각 item의 `imageField`가 함께 보낸 multipart 파일 필드명을 가리킵니다(예: image_top). ' +
        '각 item은 category(소문자 가능), selectedMeasurements(선택 사이즈 기준 납작한 치수), selectedSize, brand(브랜드명), name(상품명), sourceUrl(제품 링크), sizeTable/sizeTableSource를 가집니다. 체형은 보내지 않습니다. ' +
        '신체 치수·성별은 토큰의 user_id로 DB(body_info, profiles)에서, 아바타는 user_character에서 조회합니다. ' +
        'Gemini 이미지 생성은 타임아웃(120초)을 적용하며(타임아웃은 재시도하지 않음), 생성된 코디 이미지와 코디명은 closet_archive(+의류별 closet_items)에 저장됩니다. ' +
        '사용자당 동시에 1건만 생성할 수 있으며, 진행 중에 다시 요청하면 409를 반환합니다. ' +
        '`Idempotency-Key` 헤더(선택)를 보내면 중복 제출을 막습니다 — 같은 키가 처리 중이면 409, 이미 완료됐으면 저장된 결과(201)를 그대로 반환합니다(10분간 유효).',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            required: true,
            content: {
                'multipart/form-data': {
                    schema: GenerateCoordiRequestSchema,
                },
            },
        },
    },
    responses: {
        201: {
            description: '코디 생성 및 저장 성공',
            content: { 'application/json': { schema: GenerateCoordiResponseSchema } },
        },
        400: {
            description: '필수 데이터 누락 또는 형식 오류 (이미지/카테고리/치수)',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        401: {
            description: '인증 필요',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        404: {
            description: '아바타 정보 없음',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        409: {
            description: '이미 진행 중인 코디 생성이 있거나 동일 Idempotency-Key 요청이 처리 중',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        500: {
            description: '코디 저장 실패',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        502: {
            description: 'Gemini 코디 생성 실패 (재시도 후) 또는 이미지 저장 실패',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        504: {
            description: 'Gemini 응답 타임아웃',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
    },
});

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
    path: '/fitting/3d/{sessionId}',
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

registry.registerPath({
    method: 'patch',
    path: '/fitting/{closetArchiveId}/title',
    tags: ['Fitting'],
    summary: '피팅 결과 제목 변경',
    description:
        '피팅 결과(옷장 아카이브)의 제목을 변경합니다. ' +
        '본인 소유의 아카이브만 변경할 수 있으며, 존재하지 않거나 소유자가 아니면 404를 반환합니다.',
    security: [{ bearerAuth: [] }],
    request: {
        params: FittingTitleParamSchema,
        body: {
            content: {
                'application/json': {
                    schema: FittingTitleBodySchema,
                },
            },
        },
    },
    responses: {
        204: {
            description: '제목 변경 성공 (본문 없음)',
        },
        400: {
            description: '유효하지 않은 요청 (제목 형식 오류 또는 ID 형식 오류)',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        401: {
            description: '인증 필요',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        404: {
            description: '옷장 아카이브를 찾을 수 없음 (또는 소유자가 아님)',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/fitting/3d/{sessionId}/model',
    tags: ['Fitting'],
    summary: '3D 피팅 결과(glb) 저장',
    description:
        '완료(SUCCEEDED)된 3D 피팅 결과를 영속화합니다. ' +
        'Meshy가 생성한 glb를 우리 S3에 업로드하고, 그 링크를 closet_archive.model_url에 저장합니다. ' +
        '세션 소유자만 호출할 수 있으며, 아직 완료되지 않았으면 409를 반환합니다. (Meshy URL은 만료성이므로 완료 후 24시간 내 저장 권장)',
    security: [{ bearerAuth: [] }],
    request: {
        params: SessionIdParamSchema,
    },
    responses: {
        200: {
            description: '저장 성공',
            content: { 'application/json': { schema: UpdateFittingModelResponseSchema } },
        },
        401: {
            description: '인증 필요',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        404: {
            description: '세션 없음/만료 또는 옷장 아카이브를 찾을 수 없음',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        409: {
            description: '아직 저장할 수 있는 완료된 결과가 없음',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
        502: {
            description: '3D 결과(glb)를 가져오지 못함 (결과 링크 만료 등)',
            content: { 'application/json': { schema: ErrorResponseSchema } },
        },
    },
});

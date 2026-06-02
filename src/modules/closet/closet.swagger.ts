import { registry } from '@/config/registry';
import { ErrorResponseSchema } from '@/common/schemas/api.schema';
import { ClosetDetailResponseSchema, ClosetListResponseSchema, ClosetParamsSchema, ClosetQuerySchema } from './closet.schema';

registry.registerPath({
  method: 'get',
  path: '/closet',
  tags: ['Closet'],
  summary: '옷장 목록 조회',
  description: '로그인한 유저의 옷장 목록을 최신순으로 반환합니다. 커서 기반 페이지네이션을 지원합니다.',
  security: [{ bearerAuth: [] }],
  request: {
    query: ClosetQuerySchema,
  },
  responses: {
    200: {
      description: '옷장 목록 조회 성공',
      content: {
        'application/json': {
          schema: ClosetListResponseSchema,
        },
      },
    },
    400: {
      description: '유효하지 않은 요청',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: '인증 필요',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: '서버 내부 오류',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/closet/{id}',
  tags: ['Closet'],
  summary: '옷장 상세 조회',
  description: '특정 옷장 아카이브의 정보(2D 이미지, 3D 모델, 게시 여부)와 포함된 아이템 목록을 반환합니다.',
  security: [{ bearerAuth: [] }],
  request: {
    params: ClosetParamsSchema,
  },
  responses: {
    200: {
      description: '옷장 상세 조회 성공',
      content: { 'application/json': { schema: ClosetDetailResponseSchema } },
    },
    400: {
      description: '유효하지 않은 요청',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: '인증 필요',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: '접근 권한 없음',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: '존재하지 않는 옷장',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: '서버 내부 오류',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

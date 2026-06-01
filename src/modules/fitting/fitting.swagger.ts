import { registry } from '@/config/registry';
import { Fitting2DRequestSchema, Fitting2DResponseSchema } from './fitting.schema';
import { ErrorResponseSchema } from '@/common/schemas/api.schema';

const TAG = 'Fitting';

registry.registerPath({
  method: 'post',
  path: '/fitting/2d',
  summary: '2D 피팅 이미지 생성',
  description:
    '사용자 아바타에 의류를 입혀 2D 피팅 이미지를 생성합니다. 신체 치수는 DB의 body_info를 사용하며, 상의 이미지가 없으면 흰 티셔츠로 대체됩니다.',
  tags: [TAG],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: Fitting2DRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '피팅 이미지 생성 성공',
      content: { 'application/json': { schema: Fitting2DResponseSchema } },
    },
    400: {
      description: 'clothing JSON 형식 오류',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: '인증 실패',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: '아바타 정보 없음',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    502: {
      description: '아바타 이미지 로드 실패',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Gemini 이미지 생성 실패',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

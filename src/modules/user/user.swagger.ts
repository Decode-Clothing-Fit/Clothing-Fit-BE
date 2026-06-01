import { registry } from '@/config/registry';
import { ErrorResponseSchema } from '@/common/schemas/api.schema';

registry.registerPath({
  method: 'delete',
  path: '/users/me',
  tags: ['Users'],
  summary: '계정 탈퇴',
  security: [{ bearerAuth: [] }],
  responses: {
    204: {
      description: '탈퇴 성공',
    },
    401: {
      description: '인증 실패',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: '존재하지 않는 유저',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});
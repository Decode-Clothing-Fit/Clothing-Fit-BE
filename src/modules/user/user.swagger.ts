import { registry } from '@/config/registry';
import { ErrorResponseSchema } from '@/common/schemas/api.schema';
import { UserProfileResponseSchema } from './user.schema';
import { getPostsResponseSchema } from '@/modules/posts/posts.schema';
import { z } from 'zod';

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

registry.registerPath({
  method: 'get',
  path: '/users/{id}',
  tags: ['Users'],
  summary: '타사용자 프로필 조회',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: '프로필 조회 성공',
      content: { 'application/json': { schema: UserProfileResponseSchema } },
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

registry.registerPath({
  method: 'get',
  path: '/users/{id}/posts',
  tags: ['Users'],
  summary: '타사용자 게시글 목록 조회',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    query: z.object({
      cursor: z.string().uuid().optional(),
      limit: z.number().optional(),
    }),
  },
  responses: {
    200: {
      description: '게시글 목록 조회 성공',
      content: { 'application/json': { schema: getPostsResponseSchema } },
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
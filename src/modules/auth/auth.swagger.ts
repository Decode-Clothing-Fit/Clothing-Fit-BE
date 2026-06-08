import { registry } from '@/config/registry';
import { z } from 'zod';
import { ErrorResponseSchema } from '@/common/schemas/api.schema';

const TooManyRequestsResponse = {
  description: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  content: { 'application/json': { schema: ErrorResponseSchema } },
};

const SocialLoginResponseSchema = z
  .object({
    accessToken: z.string().openapi({ example: 'eyJhbGci...' }),
    refreshToken: z.string().openapi({ example: 'eyJhbGci...' }),
    isNewUser: z.boolean().openapi({ example: true }),
  })
  .openapi('SocialLoginResponse');

const RefreshResponseSchema = z
  .object({
    accessToken: z.string().openapi({ example: 'eyJhbGci...' }),
  })
  .openapi('RefreshResponse');

registry.registerPath({
  method: 'post',
  path: '/auth/kakao',
  tags: ['Auth'],
  summary: '카카오 소셜 로그인',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            accessToken: z.string().openapi({ example: '카카오_액세스_토큰' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: '로그인 성공',
      content: { 'application/json': { schema: SocialLoginResponseSchema } },
    },
    401: {
      description: '유효하지 않은 카카오 토큰',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    429: TooManyRequestsResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/google',
  tags: ['Auth'],
  summary: '구글 소셜 로그인',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            idToken: z.string().openapi({ example: '구글_ID_토큰' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: '로그인 성공',
      content: { 'application/json': { schema: SocialLoginResponseSchema } },
    },
    401: {
      description: '유효하지 않은 구글 토큰',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    429: TooManyRequestsResponse,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/auth/logout',
  tags: ['Auth'],
  summary: '로그아웃',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            refreshToken: z.string().openapi({ example: '리프레시_토큰' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: '로그아웃 성공',
    },
    401: {
      description: '유효하지 않은 토큰',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    429: TooManyRequestsResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  tags: ['Auth'],
  summary: '액세스 토큰 재발급',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            refreshToken: z.string().openapi({ example: '리프레시_토큰' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: '토큰 재발급 성공',
      content: { 'application/json': { schema: RefreshResponseSchema } },
    },
    401: {
      description: '유효하지 않은 토큰',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    429: TooManyRequestsResponse,
  },
});

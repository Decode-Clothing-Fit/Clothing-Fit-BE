import { registry } from '@/config/registry';
import { z } from 'zod';
import { ErrorResponseSchema } from '@/common/schemas/api.schema';
import { profileResponseSchema, checkNicknameResponseSchema, bodyInfoResponseSchema } from './profile.schema';

// 내 프로필 조회
registry.registerPath({
  method: 'get',
  path: '/profile',
  tags: ['Profile'],
  summary: '내 프로필 조회',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: '프로필 조회 성공',
      content: { 'application/json': { schema: profileResponseSchema } },
    },
    401: {
      description: '인증 실패',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// 닉네임 중복 확인
registry.registerPath({
  method: 'get',
  path: '/profile/nickname/check',
  tags: ['Profile'],
  summary: '닉네임 중복 확인',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      nickname: z.string().openapi({ example: '닉네임' }),
    }),
  },
  responses: {
    200: {
      description: '닉네임 중복 확인 성공',
      content: { 'application/json': { schema: checkNicknameResponseSchema } },
    },
    401: {
      description: '인증 실패',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// 닉네임 변경
registry.registerPath({
  method: 'patch',
  path: '/profile/nickname',
  tags: ['Profile'],
  summary: '닉네임 변경',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            nickname: z.string().openapi({ example: '새닉네임' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: '닉네임 변경 성공',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string().openapi({ example: '닉네임 변경 성공' }),
          }),
        },
      },
    },
    401: {
      description: '인증 실패',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    409: {
      description: '중복된 닉네임',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// 체형 정보 조회
registry.registerPath({
  method: 'get',
  path: '/profile/body',
  tags: ['Profile'],
  summary: '체형 정보 조회',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: '체형 정보 조회 성공',
      content: { 'application/json': { schema: bodyInfoResponseSchema } },
    },
    401: {
      description: '인증 실패',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// 체형 정보 수정
registry.registerPath({
  method: 'patch',
  path: '/profile/body',
  tags: ['Profile'],
  summary: '체형 정보 수정',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            height: z.number().openapi({ example: 175 }),
            weight: z.number().openapi({ example: 70 }),
            chest: z.number().optional().openapi({ example: 95 }),
            waist: z.number().optional().openapi({ example: 80 }),
            hip: z.number().optional().openapi({ example: 95 }),
            shoulder: z.number().optional().openapi({ example: 45 }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: '체형 정보 수정 성공',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string().openapi({ example: '체형 정보 수정 성공' }),
          }),
        },
      },
    },
    400: {
      description: '잘못된 요청',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: '인증 실패',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});
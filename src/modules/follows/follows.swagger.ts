import { registry } from '@/config/registry';
import {
  FollowParamsSchema,
  FollowsPaginationQuerySchema,
  FollowListResponseSchema,
  FollowToggleResponseSchema,
} from './follows.schema';
import { ErrorResponseSchema } from '@/common/schemas/api.schema';

export const followsRegistry = registry;

// GET /:id/followers
followsRegistry.registerPath({
  method: 'get',
  path: '/users/{id}/followers',
  tags: ['Follows'],
  summary: '팔로워 목록 조회',
  description: '특정 유저를 팔로우하는 사람들의 목록을 커서 페이지네이션으로 조회합니다.',
  request: {
    params: FollowParamsSchema,
    query: FollowsPaginationQuerySchema,
  },
responses: {
    200: {
      description: '팔로워 목록',
      content: {
        'application/json': {
          schema: FollowListResponseSchema,
        },
      },
    },
    400: {
      description: '잘못된 요청 (요청 파라미터 유효성 검사 실패)',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: '인증 실패 (토큰 누락 또는 만료)',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: '사용자를 찾을 수 없음',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// GET /:id/followings
followsRegistry.registerPath({
  method: 'get',
  path: '/users/{id}/followings',
  tags: ['Follows'],
  summary: '팔로잉 목록 조회',
  description: '특정 유저가 팔로우하는 사람들의 목록을 커서 페이지네이션으로 조회합니다.',
  request: {
    params: FollowParamsSchema,
    query: FollowsPaginationQuerySchema,
  },
  responses: {
    200: {
      description: '팔로잉 목록',
      content: {
        'application/json': {
          schema: FollowListResponseSchema,
        },
      },
    },
    400: {
      description: '잘못된 요청 (요청 파라미터 유효성 검사 실패)',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: '인증 실패 (토큰 누락 또는 만료)',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: '사용자를 찾을 수 없음',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// POST /:id/follow
followsRegistry.registerPath({
  method: 'post',
  path: '/users/{id}/follow',
  tags: ['Follows'],
  summary: '팔로우',
  description: '특정 유저를 팔로우합니다. 이미 팔로우 중이어도 멱등하게 처리됩니다.',
  request: {
    params: FollowParamsSchema,
  },
  responses: {
    200: {
      description: '팔로우 결과',
      content: {
        'application/json': {
          schema: FollowToggleResponseSchema,
        },
      },
    },
    400: {
      description: '잘못된 요청 (요청 파라미터 유효성 검사 실패) 또는 자기 자신 팔로우',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: '인증 실패 (토큰 누락 또는 만료)',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// DELETE /:id/follow
followsRegistry.registerPath({
  method: 'delete',
  path: '/users/{id}/follow',
  tags: ['Follows'],
  summary: '언팔로우',
  description: '특정 유저에 대한 팔로우를 취소합니다. 팔로우 상태가 아니어도 멱등하게 처리됩니다.',
  request: {
    params: FollowParamsSchema,
  },
  responses: {
    200: {
      description: '언팔로우 결과',
      content: {
        'application/json': {
          schema: FollowToggleResponseSchema,
        },
      },
    },
    400: {
      description: '잘못된 요청 (요청 파라미터 유효성 검사 실패)',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: '인증 실패 (토큰 누락 또는 만료)',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});
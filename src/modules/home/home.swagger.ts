import { registry } from '@/config/registry';
import {
  popularPostsResponseSchema,
  recommendedInfluencersResponseSchema,
} from './home.schema';

export const homeRegistry = registry;

// 인기글 목록
homeRegistry.registerPath({
  method: 'get',
  path: '/home/popular-posts',
  tags: ['Home'],
  summary: '인기글 목록 조회',
  description: '좋아요 순으로 인기 게시글을 최대 10개 조회합니다.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: '인기글 목록 조회 성공',
      content: {
        'application/json': {
          schema: popularPostsResponseSchema,
        },
      },
    },
    401: {
      description: '인증 실패',
    },
  },
});

// 추천 인플루언서
homeRegistry.registerPath({
  method: 'get',
  path: '/home/recommended-influencers',
  tags: ['Home'],
  summary: '추천 인플루언서 조회',
  description: '최근 7일간 팔로워 증가량이 많은 순으로 추천 인플루언서를 최대 10개 조회합니다. 게시글이 1개 이상이고, 최근 7일간 팔로워가 1명이라도 증가한 유저만 포함됩니다. 대표 게시글 이미지는 좋아요 수 기준입니다.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: '추천 인플루언서 조회 성공',
      content: {
        'application/json': {
          schema: recommendedInfluencersResponseSchema,
        },
      },
    },
    401: {
      description: '인증 실패',
    },
  },
});
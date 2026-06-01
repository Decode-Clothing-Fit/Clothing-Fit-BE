import { authenticate } from '@/common/middleware/auth.middleware';
import { type Router as RouterType, Router } from 'express';
import { getPopularPosts, getRecommendedInfluencers } from './home.controller';

const router: RouterType = Router();

// 인기글 목록
router.get('/popular-posts', authenticate, getPopularPosts);

// 추천 인플루언서
router.get('/recommended-influencers', authenticate, getRecommendedInfluencers);

export default router;

/*
인기글 목록 (최대 10개)
입력: 인증
출력: [이미지, 닉네임, 날짜, 좋아요 수 및 여부, 아이템 5개 이미지] * 0~10
출력 정렬: 좋아요 순, 같으면 최신순?

추천 인플루언서 (10개)
입력: 인증
출력: [게시글 이미지(최다 좋아요, 같으면 최신순), 프로필 이미지, 닉네임, 팔로워 수, 팔로우 상태 및 여부] * 0~10

대충 게시글은 다 좋아요순, 
*/
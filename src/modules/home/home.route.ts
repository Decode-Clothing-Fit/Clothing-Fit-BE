import { authenticate } from '@/common/middleware/auth.middleware';
import { type Router as RouterType, Router } from 'express';
import { getPopularPosts, getRecommendedInfluencers } from './home.controller';

const router: RouterType = Router();

// 인기글 목록
router.get('/popular-posts', authenticate, getPopularPosts);

// 추천 인플루언서
router.get('/recommended-influencers', authenticate, getRecommendedInfluencers);

export default router;
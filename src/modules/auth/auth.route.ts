import { type Router as RouterType, Router } from 'express';
import { validate } from '@/common/middleware/validate.middleware';
import { authenticate } from '@/common/middleware/auth.middleware';
import { googleLoginController, kakaoLoginController, logoutController, refreshController } from './auth.controller';
import { googleLoginSchema, kakaoLoginSchema, logoutBodySchema, refreshTokenSchema } from './auth.schema';
import { authRateLimit } from '@/config/rate-limit';

const router: RouterType = Router();

// 카카오 소셜 로그인
router.post('/kakao', authRateLimit, validate({ body: kakaoLoginSchema }), kakaoLoginController);

// 구글 소셜 로그인
router.post('/google', authRateLimit, validate({ body: googleLoginSchema }), googleLoginController);

// 로그아웃
router.delete('/logout', authRateLimit, authenticate, validate({ body: logoutBodySchema }), logoutController);

// 토큰 재발급
router.post('/refresh', authRateLimit, validate({ body: refreshTokenSchema }), refreshController);

export default router;
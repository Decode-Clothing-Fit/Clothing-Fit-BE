import { type Router as RouterType, Router } from 'express';
import { validate } from '@/common/middleware/validate.middleware';
import { googleLoginController, kakaoLoginController, logoutController,refreshController } from './auth.controller';
import { googleLoginSchema, kakaoLoginSchema, refreshTokenSchema } from './auth.schema';

const router: RouterType = Router();

// 카카오 소셜 로그인
router.post('/kakao', validate({ body: kakaoLoginSchema }), kakaoLoginController);

// 구글 소셜 로그인
router.post('/google', validate({ body: googleLoginSchema }), googleLoginController);

// 로그아웃
router.delete('/logout', validate({ body: refreshTokenSchema }), logoutController);

// 토큰 재발급
router.post('/refresh', validate({ body: refreshTokenSchema }), refreshController);

export default router;
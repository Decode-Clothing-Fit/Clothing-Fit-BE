import { type Router as RouterType, Router } from 'express';
import { validate } from '@/common/middleware/validate.middleware';
import { kakaoLoginController, logoutController,refreshController } from './auth.controller';
import { kakaoLoginSchema, refreshTokenSchema } from './auth.schema';

const router: RouterType = Router();

router.post('/kakao', validate({body: kakaoLoginSchema}),
kakaoLoginController);

router.delete('/logout', validate({ body: refreshTokenSchema }), logoutController);

router.post('/refresh', validate({ body: refreshTokenSchema }), refreshController);

export default router;
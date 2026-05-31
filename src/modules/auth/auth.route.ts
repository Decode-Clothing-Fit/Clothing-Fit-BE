import { type Router as RouterType, Router } from 'express';
import { validate } from '@/common/middleware/validate.middleware';
import { kakaoLoginController } from './auth.controller';
import { kakaoLoginSchema } from './auth.schema';

const router: RouterType = Router();

router.post('/kakao', validate({body: kakaoLoginSchema}),
kakaoLoginController);

export default router;
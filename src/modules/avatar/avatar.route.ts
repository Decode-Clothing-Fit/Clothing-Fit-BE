import { type Router as RouterType, Router } from 'express';
import { authenticate } from '@/common/middleware/auth.middleware';
import { getUserAvatarController } from "./avatar.controller";

const router: RouterType = Router();

router.get('/', authenticate, getUserAvatarController);

export default router;
import { type Router as RouterType, Router } from 'express';
import { authenticate } from '@/common/middleware/auth.middleware';
import { deleteUserController } from './user.controller';

const router: RouterType = Router();

router.delete('/me', authenticate, deleteUserController);
export default router;
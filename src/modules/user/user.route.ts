import { type Router as RouterType, Router } from 'express';
import { authenticate } from '@/common/middleware/auth.middleware';
import { deleteUserController, getUserProfileController } from './user.controller';

const router: RouterType = Router();

router.get('/:id', authenticate, getUserProfileController)

router.delete('/me', authenticate, deleteUserController);
export default router;
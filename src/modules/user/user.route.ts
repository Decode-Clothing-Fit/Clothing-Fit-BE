import { type Router as RouterType, Router } from 'express';
import { authenticate } from '@/common/middleware/auth.middleware';
import { deleteUserController, getUserPostsController, getUserProfileController } from './user.controller';
import { validate } from '@/common/middleware/validate.middleware';
import { getUserPostsQuerySchema } from './user.schema';

const router: RouterType = Router();

router.get('/:id', authenticate, getUserProfileController)

router.get('/:id/posts', authenticate, validate({
    query: getUserPostsQuerySchema
}), getUserPostsController);

router.delete('/me', authenticate, deleteUserController);
export default router;
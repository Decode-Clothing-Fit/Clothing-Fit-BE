import { type Router as RouterType, Router } from 'express';
import { authenticate } from '@/common/middleware/auth.middleware';
import { deleteUserController, getUserPostsController, getUserProfileController } from './user.controller';
import { validate } from '@/common/middleware/validate.middleware';
import { getUserPostsQuerySchema, userIdParamSchema } from './user.schema';

const router: RouterType = Router();

router.delete('/me', authenticate, deleteUserController);

router.get('/:id', authenticate, validate({ params: userIdParamSchema }), getUserProfileController);

router.get('/:id/posts', authenticate, validate({ params: userIdParamSchema, query: getUserPostsQuerySchema }), getUserPostsController);

export default router;
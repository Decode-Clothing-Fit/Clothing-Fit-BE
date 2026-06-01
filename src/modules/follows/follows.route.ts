import { type Router as RouterType, Router } from 'express';
import { followUser, getFollowers, getFollowings, unfollowUser } from './follows.controller';
import { validate } from '@/common/middleware/validate.middleware';
import { FollowParamsSchema, FollowsPaginationQuerySchema } from './follows.schema';
import { authenticate } from '@/common/middleware/auth.middleware';

const router: RouterType = Router();

router.get('/:id/followers', authenticate, validate({ params: FollowParamsSchema, query: FollowsPaginationQuerySchema }), getFollowers);
router.get('/:id/followings', authenticate, validate({ params: FollowParamsSchema, query: FollowsPaginationQuerySchema }), getFollowings);
router.post('/:id/follow', authenticate, validate({ params: FollowParamsSchema }), followUser);
router.delete('/:id/follow', authenticate, validate({ params: FollowParamsSchema }), unfollowUser);

export default router;
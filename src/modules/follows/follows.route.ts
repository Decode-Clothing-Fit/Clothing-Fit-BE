import { type Router as RouterType, Router } from 'express';
import { followUser, getFollowers, getFollowings, unfollowUser } from './follows.controller';
import { validate } from '@/common/middleware/validate.middleware';
import { FollowParamsSchema, FollowsPaginationQuerySchema } from './follows.schema';
import { authenticate } from '@/common/middleware/auth.middleware';
import { asyncHandler } from '@/common/utils/async.handler';

const router: RouterType = Router();

router.get('/:id/followers', validate({ params: FollowParamsSchema, query: FollowsPaginationQuerySchema }), authenticate, asyncHandler(getFollowers));
router.get('/:id/followings', validate({ params: FollowParamsSchema, query: FollowsPaginationQuerySchema }), authenticate, asyncHandler(getFollowings));
router.post('/:id/follow', validate({ params: FollowParamsSchema }), authenticate, asyncHandler(followUser));
router.delete('/:id/follow', validate({ params: FollowParamsSchema }), authenticate, asyncHandler(unfollowUser));

export default router;
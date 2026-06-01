import type { Request, Response } from 'express';
import { followUserService, getFollowersService, getFollowingsService, unfollowUserService } from './follows.service';
import { FollowParams, FollowsPaginationQuery } from './follows.schema';
import { asyncHandler } from '@/common/utils/async.handler';
import { StatusCodes } from 'http-status-codes';

export const getFollowers = asyncHandler(async (req: Request, res: Response) => {
  const result = await getFollowersService((req.params as FollowParams).id, req.user!.id, req.query as unknown as FollowsPaginationQuery);
  res.status(StatusCodes.OK).json(result);
});

export const getFollowings = asyncHandler(async (req: Request, res: Response) => {
  const result = await getFollowingsService((req.params as FollowParams).id, req.user!.id, req.query as unknown as FollowsPaginationQuery);
  res.status(StatusCodes.OK).json(result);
});

export const followUser = asyncHandler(async (req: Request, res: Response) => {
  const result = await followUserService((req.params as FollowParams).id, req.user!.id);
  res.status(StatusCodes.OK).json(result);
});

export const unfollowUser = asyncHandler(async (req: Request, res: Response) => {
  const result = await unfollowUserService((req.params as FollowParams).id, req.user!.id);
  res.status(StatusCodes.OK).json(result);
});
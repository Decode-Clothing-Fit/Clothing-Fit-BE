import type { Request, Response } from 'express';
import { followUserService, getFollowersService, getFollowingsService, unfollowUserService } from './follows.service';
import { FollowParams, FollowsPaginationQuery } from './follows.schema';

export const getFollowers = async (req: Request, res: Response) => {
  const result = await getFollowersService((req.params as FollowParams).id, req.user!.id, req.query as unknown as FollowsPaginationQuery);
  res.status(200).json(result);
};

export const getFollowings = async (req: Request, res: Response) => {
  const result = await getFollowingsService((req.params as FollowParams).id, req.user!.id, req.query as unknown as FollowsPaginationQuery);
  res.status(200).json(result);
};

export const followUser = async (req: Request, res: Response) => {
  const result = await followUserService((req.params as FollowParams).id, req.user!.id);
  res.status(200).json(result);
};

export const unfollowUser = async (req: Request, res: Response) => {
  const result = await unfollowUserService((req.params as FollowParams).id, req.user!.id);
  res.status(200).json(result);
};
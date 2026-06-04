import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '@/common/utils/async.handler';
import { getProfile, checkNickname, updateNickname,
  getBodyInfo, updateBodyInfo, getRecentPosts, getBookmarkedPosts, getLikedPosts } from './profile.service';
import type { CheckNicknameQuery, UpdateNicknameBody, UpdateBodyInfoBody, ProfilePostsQuery } from './profile.schema';

export const getProfileController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const result = await getProfile(userId);

  res.status(StatusCodes.OK).json({ data: result });
});

export const checkNicknameController = asyncHandler(async (req: Request, res: Response) => {
  const { nickname } = req.query as CheckNicknameQuery;

  const result = await checkNickname(nickname);

  res.status(StatusCodes.OK).json({ data: result });
});

export const updateNicknameController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const body = req.body as UpdateNicknameBody;

  await updateNickname(userId, body);

  res.status(StatusCodes.OK).send();
});

export const getBodyInfoController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const result = await getBodyInfo(userId);

  res.status(StatusCodes.OK).json({ data: result });
});

export const updateBodyInfoController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const body = req.body as UpdateBodyInfoBody;

  await updateBodyInfo(userId, body);

  res.status(StatusCodes.OK).send();
});

export const getRecentPostsController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const query = req.query as unknown as ProfilePostsQuery;

  const result = await getRecentPosts(userId, query);

  res.status(StatusCodes.OK).json({ data: result });
});

export const getBookmarkedPostsController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const query = req.query as unknown as ProfilePostsQuery;

  const result = await getBookmarkedPosts(userId, query);

  res.status(StatusCodes.OK).json({ data: result });
});

export const getLikedPostsController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const query = req.query as unknown as ProfilePostsQuery;

  const result = await getLikedPosts(userId, query);

  res.status(StatusCodes.OK).json({ data: result });
});
import { Request, Response } from 'express';
import { getPopularPostsService, getRecommendedInfluencersService } from './home.service';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '@/common/utils/async.handler';

// 인기글 목록
export const getPopularPosts = asyncHandler(async (req: Request, res: Response) => {
  const result = await getPopularPostsService(req.user!.id);
  res.status(StatusCodes.OK).json(result);
});

// 추천 인플루언서
export const getRecommendedInfluencers = asyncHandler(async (req: Request, res: Response) => {
  const result = await getRecommendedInfluencersService(req.user!.id);
  res.status(StatusCodes.OK).json(result);
});
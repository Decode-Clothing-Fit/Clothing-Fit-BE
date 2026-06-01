import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '@/common/utils/async.handler';
import { parsePaginationParams } from '@/common/utils/pagination';
import { getClosets } from './closet.service';
import { getClosetDetail, getClosets } from './closet.service';
import type { ClosetItemDetail } from './closet.service';
import type { ApiResponse } from '@/common/types/api';

export const getClosetsController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const params = parsePaginationParams(req.query);

  const result = await getClosets(userId, params);

  res.status(StatusCodes.OK).json(result);
});

export const getClosetDetailController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const items = await getClosetDetail(userId, id);

  const result: ApiResponse<ClosetItemDetail[]> = { data: items };
  res.status(StatusCodes.OK).json(result);
});

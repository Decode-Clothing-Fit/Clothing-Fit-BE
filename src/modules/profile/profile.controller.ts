import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '@/common/utils/async.handler';
import { getProfile, checkNickname, updateNickname } from './profile.service';
import type { CheckNicknameQuery, UpdateNicknameBody } from './profile.schema';

export const getProfileController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const result = await getProfile(userId);

  res.status(StatusCodes.OK).json({
    message: '프로필 조회 성공',
    data: result,
  });
});

export const checkNicknameController = asyncHandler(async (req: Request, res: Response) => {
  const { nickname } = req.query as CheckNicknameQuery;

  const result = await checkNickname(nickname);

  res.status(StatusCodes.OK).json({
    message: '닉네임 중복 확인 성공',
    data: result,
  });
});

export const updateNicknameController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const body = req.body as UpdateNicknameBody;

  await updateNickname(userId, body);

  res.status(StatusCodes.OK).json({
    message: '닉네임 변경 성공',
  });
});
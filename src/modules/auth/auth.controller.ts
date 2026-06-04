import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '@/common/utils/async.handler';
import { kakaoLogin,logout, refresh, googleLogin } from './auth.service';

export const kakaoLoginController = asyncHandler(async (req: Request, res: Response) => {
    const { accessToken } = req.body;

    const result = await kakaoLogin(accessToken);

    res.status(StatusCodes.OK).json({ data: result });
})

export const logoutController = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  await logout(refreshToken);

  res.status(StatusCodes.OK).send();
});

export const refreshController = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  const result = await refresh(refreshToken);

  res.status(StatusCodes.OK).json({ data: result });
});

export const googleLoginController = asyncHandler(async (req: Request, res: Response) => {
    const { idToken } = req.body;

    const result = await googleLogin(idToken);

    res.status(StatusCodes.OK).json({ data: result });
})
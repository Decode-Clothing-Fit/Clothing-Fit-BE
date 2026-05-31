import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '@/common/utils/async.handler';
import { kakaoLogin } from './auth.service';

export const kakaoLoginController = asyncHandler(async (req: Request, res: Response) => {
    const { accessToken } = req.body;

    const result = await kakaoLogin(accessToken);

    res.status(StatusCodes.OK).json({
        message: '카카오 로그인 성공',
        data: result,
    })
})
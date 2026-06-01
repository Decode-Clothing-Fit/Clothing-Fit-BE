import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '@/common/utils/async.handler';
import { deleteUser, getUserProfile } from './user.service';

export const deleteUserController = asyncHandler(async (req: Request, res: Response) =>
 {
    const userId = req.user!.id;

    await deleteUser(userId);

    res.status(StatusCodes.NO_CONTENT).send();
 })

 export const getUserProfileController = asyncHandler(async (req:Request, res: Response) => {
   const { id } = req.params;

   const result = await getUserProfile(id);

   res.status(StatusCodes.OK).json({
      message: '유저 프로필 조회 성공',
      data: result
   })
 })
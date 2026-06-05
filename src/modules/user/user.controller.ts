import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '@/common/utils/async.handler';
import { deleteUser, getUserProfile, getUserPosts } from './user.service';
import { GetUserPostsQuery } from './user.schema';

export const deleteUserController = asyncHandler(async (req: Request, res: Response) =>
 {
    const userId = req.user!.id;

    await deleteUser(userId);

    res.status(StatusCodes.NO_CONTENT).send();
 })

 export const getUserProfileController = asyncHandler(async (req:Request, res: Response) => {
   const { id } = req.params;

   const result = await getUserProfile(id);

   res.status(StatusCodes.OK).json(result);
 })

 export const getUserPostsController = asyncHandler(async (req: Request, res: Response) =>
 {  const { id } = req.params;
   const requesterId = req.user!.id;
   const query = req.query as unknown as GetUserPostsQuery;

   const result = await getUserPosts(id, requesterId, query);

   res.status(StatusCodes.OK).json(result);
})
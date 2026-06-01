import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '@/common/utils/async.handler';
import { deleteUser } from './user.service';

export const deleteUserController = asyncHandler(async (req: Request, res: Response) =>
 {
    const userId = req.user!.id;

    await deleteUser(userId);

    res.status(StatusCodes.NO_CONTENT).send();
 })
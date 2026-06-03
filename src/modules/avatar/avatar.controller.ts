import type { Request, Response } from "express";
import type { ApiResponse } from "@/common/types/api";
import { StatusCodes } from "http-status-codes";
import { asyncHandler } from "@/common/utils/async.handler";
import { getUserAvatar, type UserAvatar } from "./avatar.service";

export const getUserAvatarController = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const avatar = await getUserAvatar(userId)
    const result: ApiResponse<UserAvatar> = {data: avatar}

    res.status(StatusCodes.OK).json(result)
})
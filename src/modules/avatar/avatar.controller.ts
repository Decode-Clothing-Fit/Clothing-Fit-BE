import type { Request, Response } from "express";
import type { ApiResponse } from "@/common/types/api";
import { StatusCodes } from "http-status-codes";
import { asyncHandler } from "@/common/utils/async.handler";
import {getUserAvatar, updateUserAvatar, updateUserAvatarImage, type UserAvatar} from "./avatar.service";

export const getUserAvatarController = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const avatar = await getUserAvatar(userId)
    const result: ApiResponse<UserAvatar> = {data: avatar}

    res.status(StatusCodes.OK).json(result)
})

export const updateUserAvatarController = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { characterId } = req.body;

    const avatar = await updateUserAvatar(userId, characterId);
    const result: ApiResponse<UserAvatar> = { data: avatar };

    res.status(StatusCodes.OK).json(result);
})

export const updateUserAvatarImageController = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    // 파일 존재/형식/용량 검증은 singleImageUpload 미들웨어가 보장
    const avatar = await updateUserAvatarImage(userId, req.file!.buffer);

    const result: ApiResponse<UserAvatar> = { data: avatar };
    res.status(StatusCodes.OK).json(result);
})
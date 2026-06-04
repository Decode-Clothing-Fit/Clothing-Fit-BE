import type { Request, Response } from "express";
import type { ApiResponse } from "@/common/types/api";
import { StatusCodes } from "http-status-codes";
import { asyncHandler } from "@/common/utils/async.handler";
import { AppError } from "@/common/errors/app-error";
import { ErrorCode } from "@/common/errors/error-code";
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

    if (!req.file) {
        throw new AppError(ErrorCode.INVALID_FILE_TYPE, '이미지 파일이 필요합니다.', StatusCodes.BAD_REQUEST);
    }

    const avatar = await updateUserAvatarImage(userId, req.file.buffer);
    const result: ApiResponse<UserAvatar> = { data: avatar };

    res.status(StatusCodes.OK).json(result);
})
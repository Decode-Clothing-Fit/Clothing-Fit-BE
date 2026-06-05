import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { asyncHandler } from "@/common/utils/async.handler";
import { AppError } from "@/common/errors/app-error";
import { ErrorCode } from "@/common/errors/error-code";
import { getUserAvatar, updateUserAvatar, updateUserAvatarImage } from "./avatar.service";

export const getUserAvatarController = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const result = await getUserAvatar(userId)

    res.status(StatusCodes.OK).json(result)
})

export const updateUserAvatarController = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { characterId } = req.body;

    const result = await updateUserAvatar(userId, characterId);

    res.status(StatusCodes.OK).json(result);
})

export const updateUserAvatarImageController = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    // 파일 존재/형식/용량 검증은 singleImageUpload 미들웨어가 보장하지만,
    // 미들웨어 체인이 변경/누락되어도 TypeError(500) 대신 명시적 400을 내도록 방어한다.
    const file = req.file;
    if (!file) {
        throw new AppError(ErrorCode.INVALID_FILE_TYPE, '이미지 파일이 필요합니다.', StatusCodes.BAD_REQUEST);
    }

    const result = await updateUserAvatarImage(userId, file.buffer);

    res.status(StatusCodes.OK).json(result);
})
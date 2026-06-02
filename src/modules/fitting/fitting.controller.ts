import type { Request, Response } from 'express';
import { asyncHandler } from '@/common/utils/async.handler';
import { start3DFitting, get3DFittingStatus } from './fitting.service';
import {StatusCodes} from "http-status-codes";

export const start3DFittingController = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { closetArchiveId } = req.body;

    const sessionId = await start3DFitting(userId, closetArchiveId);

    res.status(StatusCodes.ACCEPTED).json({
        message: '3D 피팅 생성 시작',
        data: { sessionId },
    });
});

const STATUS_MESSAGES: Record<string, string> = {
    QUEUED: '3D 피팅 대기 중',
    PROCESSING: '3D 피팅 생성 중',
    SUCCEEDED: '3D 피팅 생성 완료',
    FAILED: '3D 피팅 생성 실패',
};

export const get3DFittingStatusController = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { sessionId } = req.params;

    const result = await get3DFittingStatus(userId, sessionId);

    res.status(StatusCodes.OK).json({
        message: STATUS_MESSAGES[result.status] ?? '3D 피팅 상태 조회',
        data: result,
    });
});

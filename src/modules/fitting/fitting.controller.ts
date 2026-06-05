import type { Request, Response } from 'express';
import { asyncHandler } from '@/common/utils/async.handler';
import {
    start3DFitting,
    get3DFittingStatus,
    updateFittingTitle,
    updateFittingModel
} from './fitting.service';
import {StatusCodes} from "http-status-codes";

export const start3DFittingController = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { closetArchiveId } = req.body;

    const sessionId = await start3DFitting(userId, closetArchiveId);

    res.status(StatusCodes.ACCEPTED).json({ sessionId });
});

export const get3DFittingStatusController = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { sessionId } = req.params;

    const result = await get3DFittingStatus(userId, sessionId);

    res.status(StatusCodes.OK).json(result);
});

export const updateFittingTitleController = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { closetArchiveId } = req.params;
    const { title } = req.body;

    await updateFittingTitle(userId, closetArchiveId, title);

    res.status(StatusCodes.NO_CONTENT).send();
});

export const updateFittingModelController = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { sessionId } = req.params;

    const { modelUrl } = await updateFittingModel(userId, sessionId);

    res.status(StatusCodes.OK).json({ modelUrl });
});

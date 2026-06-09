import type { Request, Response } from 'express';
import { asyncHandler } from '@/common/utils/async.handler';
import { AppError } from '@/common/errors/app-error';
import { ErrorCode } from '@/common/errors/error-code';
import {
    start3DFitting,
    get3DFittingStatus,
    updateFittingTitle,
    updateFittingModel,
    generateCoordi
} from './fitting.service';
import { CoordiItemsSchema } from './fitting.schema';
import {StatusCodes} from "http-status-codes";

export const generateCoordiController = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    // anyImageUpload는 req.files를 배열로 채운다 (필드명이 동적이므로)
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];

    // 의류 메타데이터(meta JSON) 파싱 — { items: [...] } 또는 배열 두 형태 모두 허용
    if (!req.body.meta) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, '의류 정보(meta)를 입력해주세요.', StatusCodes.BAD_REQUEST);
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(req.body.meta);
    } catch {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'meta 형식이 올바르지 않습니다.', StatusCodes.BAD_REQUEST);
    }
    const rawItems = Array.isArray(parsed) ? parsed : (parsed as { items?: unknown })?.items;
    const items = CoordiItemsSchema.parse(rawItems);

    // imageField로 multipart 파일을 매칭해 의류 조립 (요청 순서 유지)
    const fileByField = new Map(files.map((f) => [f.fieldname, f]));
    const garments = items.map((item) => {
        const image = fileByField.get(item.imageField);
        if (!image) {
            throw new AppError(
                ErrorCode.VALIDATION_ERROR,
                `'${item.imageField}' 필드의 이미지가 없습니다.`,
                StatusCodes.BAD_REQUEST,
            );
        }
        // garment가 실제로 쓰는 필드만 명시적으로 전달 (sizeTable/sizeTableSource는 수신만 하고 사용 안 함)
        return {
            category: item.category,
            image,
            measurements: item.selectedMeasurements,
            selectedSize: item.selectedSize,
            title: item.title,
            sourceUrl: item.sourceUrl,
        };
    });

    const { closetArchiveId, imageUrl, outfitName } = await generateCoordi(userId, garments);

    res.status(StatusCodes.CREATED).json({ imageUrl, archiveId: closetArchiveId, outfitName });
});

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

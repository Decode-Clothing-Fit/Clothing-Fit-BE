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
    // parse는 검증 실패 시 ZodError를 던진다. 그대로 두면 AppError가 아니라 500으로 떨어지므로,
    // validate 미들웨어와 동일하게 400 VALIDATION_ERROR로 매핑한다.
    const result = CoordiItemsSchema.safeParse(rawItems);
    if (!result.success) {
        throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            result.error.errors[0]?.message ?? '의류 정보(meta)가 올바르지 않습니다.',
            StatusCodes.BAD_REQUEST,
        );
    }
    const items = result.data;

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
            brand: item.brand,
            name: item.name,
            sourceUrl: item.sourceUrl,
        };
    });

    // 멱등성 키(선택): 동일 키 재요청 시 중복 생성 대신 진행 중 409 / 완료된 결과 재반환
    const idempotencyKey = req.header('Idempotency-Key') || undefined;

    const { closetArchiveId, imageUrl, outfitName } = await generateCoordi(userId, garments, idempotencyKey);

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

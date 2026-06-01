import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '@/common/utils/async.handler';
import { AppError } from '@/common/errors/app-error';
import { ErrorCode } from '@/common/errors/error-code';
import { generate2DFitting } from './fitting.service';
import { Fitting2DBodySchema } from './fitting.schema';

export const generate2DFittingController = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const files = req.files as Record<string, Express.Multer.File[]>;
  const fittingImages = {
    topImage: files?.topImage?.[0],
    bottomImage: files?.bottomImage?.[0],
    footwearImage: files?.footwearImage?.[0],
  };

  let clothingParsed: unknown;
  if (req.body.clothing) {
    try {
      clothingParsed = JSON.parse(req.body.clothing);
    } catch {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'clothing 형식이 올바르지 않습니다.', 400);
    }
  }

  const fittingBody = Fitting2DBodySchema.parse({
    clothing: clothingParsed,
  });

  const result = await generate2DFitting(userId, fittingImages, fittingBody);

  res.status(StatusCodes.OK).json({ data: result });
});

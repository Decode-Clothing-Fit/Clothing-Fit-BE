import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '@/common/errors/app-error';
import { ErrorCode } from '@/common/errors/error-code';

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024;
const DEFAULT_ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'];

type ImageUploadOptions = {
    /** multipart 필드명 (예: 'image') */
    field: string;
    /** 최대 파일 크기(바이트). 기본 5MB */
    maxSizeBytes?: number;
    /** 허용 MIME 화이트리스트. 기본 png/jpeg/webp */
    allowedMime?: string[];
    /** 파일을 필수로 요구할지. 기본 true (없으면 400) */
    required?: boolean;
};

type AnyImageOptions = {
    /** 최대 파일 크기(바이트). 기본 5MB */
    maxSizeBytes?: number;
    /** 허용 MIME 화이트리스트. 기본 png/jpeg/webp */
    allowedMime?: string[];
    /** 최소 1개 파일을 요구할지. 기본 true (전부 없으면 400) */
    requireAtLeastOne?: boolean;
};

/** memoryStorage + MIME 화이트리스트 + 용량 제한이 적용된 multer 인스턴스를 만든다. */
function createUploader(maxSizeBytes: number, allowedMime: string[]) {
    return multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: maxSizeBytes },
        fileFilter: (_, file, cb) => {
            if (allowedMime.includes(file.mimetype)) {
                cb(null, true);
            } else {
                const types = allowedMime.map((m) => m.replace('image/', '')).join(', ');
                cb(new Error(`${types} 이미지만 업로드 가능합니다.`));
            }
        },
    });
}

/** multer 에러(용량 초과/형식 오류)를 적절한 상태코드의 AppError로 변환한다. */
function toUploadError(err: unknown, maxSizeBytes: number): AppError {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            const maxMb = Math.floor(maxSizeBytes / (1024 * 1024));
            return new AppError(ErrorCode.FILE_TOO_LARGE, `이미지는 ${maxMb}MB 이하여야 합니다.`, StatusCodes.REQUEST_TOO_LONG);
        }
        return new AppError(ErrorCode.INVALID_FILE_TYPE, '파일 업로드에 실패했습니다.', StatusCodes.BAD_REQUEST);
    }
    // fileFilter에서 던진 형식 오류 등
    const message = err instanceof Error ? err.message : '파일 업로드에 실패했습니다.';
    return new AppError(ErrorCode.INVALID_FILE_TYPE, message, StatusCodes.BAD_REQUEST);
}

/**
 * 단일 이미지 파일 업로드 미들웨어를 생성합니다.
 * memoryStorage + MIME 화이트리스트 + 용량 제한을 적용하고,
 * multer 에러(용량 초과/형식 오류)를 적절한 상태코드의 AppError로 변환합니다.
 */
export const singleImageUpload = (options: ImageUploadOptions) => {
    const { field, maxSizeBytes = DEFAULT_MAX_SIZE, allowedMime = DEFAULT_ALLOWED_MIME, required = true } = options;
    const upload = createUploader(maxSizeBytes, allowedMime);

    return (req: Request, res: Response, next: NextFunction): void => {
        upload.single(field)(req, res, (err: unknown) => {
            if (err) return next(toUploadError(err, maxSizeBytes));
            if (required && !req.file) {
                return next(new AppError(ErrorCode.INVALID_FILE_TYPE, '이미지 파일이 필요합니다.', StatusCodes.BAD_REQUEST));
            }
            return next();
        });
    };
};

/**
 * 필드명이 동적인(런타임에 정해지는) 이미지들을 받는 업로드 미들웨어를 생성합니다.
 * 클라이언트가 임의 필드명으로 보낸 파일들을 모두 받아 req.files(배열)에 담으며,
 * 단일/다중 업로드와 동일한 MIME 화이트리스트·용량 제한·에러 변환을 적용합니다.
 * (필드명이 메타데이터에서 참조되는 경우 등에 사용)
 */
export const anyImageUpload = (options: AnyImageOptions = {}) => {
    const { maxSizeBytes = DEFAULT_MAX_SIZE, allowedMime = DEFAULT_ALLOWED_MIME, requireAtLeastOne = true } = options;
    const upload = createUploader(maxSizeBytes, allowedMime);

    return (req: Request, res: Response, next: NextFunction): void => {
        upload.any()(req, res, (err: unknown) => {
            if (err) return next(toUploadError(err, maxSizeBytes));
            if (requireAtLeastOne) {
                const files = req.files as Express.Multer.File[] | undefined;
                if (!files || files.length === 0) {
                    return next(new AppError(ErrorCode.INVALID_FILE_TYPE, '이미지 파일이 최소 1개 필요합니다.', StatusCodes.BAD_REQUEST));
                }
            }
            return next();
        });
    };
};

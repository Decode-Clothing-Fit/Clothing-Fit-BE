import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError } from '@/common/errors/app-error';
import { ErrorCode } from '@/common/errors/error-code';

type ImageUploadOptions = {
    /** multipart 필드명 (예: 'image') */
    field: string;
    /** 최대 파일 크기(바이트). 기본 5MB */
    maxSizeBytes?: number;
    /** 허용 MIME 화이트리스트. 기본 png/jpeg/webp */
    allowedMime?: string[];
};

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024;
const DEFAULT_ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * 단일 이미지 파일 업로드 미들웨어를 생성합니다.
 * memoryStorage + MIME 화이트리스트 + 용량 제한을 적용하고,
 * multer 에러(용량 초과/형식 오류)를 적절한 상태코드의 AppError로 변환합니다.
 */
export const singleImageUpload = (options: ImageUploadOptions) => {
    const { field, maxSizeBytes = DEFAULT_MAX_SIZE, allowedMime = DEFAULT_ALLOWED_MIME } = options;

    const upload = multer({
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

    return (req: Request, res: Response, next: NextFunction): void => {
        upload.single(field)(req, res, (err: unknown) => {
            if (!err) return next();
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    const maxMb = Math.floor(maxSizeBytes / (1024 * 1024));
                    return next(new AppError(ErrorCode.FILE_TOO_LARGE, `이미지는 ${maxMb}MB 이하여야 합니다.`, 413));
                }
                return next(new AppError(ErrorCode.INVALID_FILE_TYPE, '파일 업로드에 실패했습니다.', 400));
            }
            // fileFilter에서 던진 형식 오류 등
            const message = err instanceof Error ? err.message : '파일 업로드에 실패했습니다.';
            return next(new AppError(ErrorCode.INVALID_FILE_TYPE, message, 400));
        });
    };
};

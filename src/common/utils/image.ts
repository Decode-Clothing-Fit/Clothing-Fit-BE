import sharp from 'sharp';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '@/common/errors/app-error';
import { ErrorCode } from '@/common/errors/error-code';

// 실제 이미지 바이트(sharp metadata.format)로 검증되는 허용 포맷 → 확장자
export const ALLOWED_IMAGE_FORMATS: Record<string, string> = {
    png: 'png',
    jpeg: 'jpg',
    webp: 'webp',
};

export type ImageFormat = 'png' | 'jpeg' | 'webp';

/**
 * 압축 폭탄(decompression bomb) 방어: 디코딩 허용 최대 입력 픽셀 수.
 * 작은 파일이 거대한 해상도로 풀리며 메모리/CPU를 소진하는 것을 막는다.
 * 상한 초과 시 sharp가 metadata()/toBuffer() 단계에서 에러를 던진다. (24MP ≈ 6000×4000)
 */
const MAX_INPUT_PIXELS = 24_000_000;

export type NormalizedImage = {
    /** 정규화(EXIF 제거·orientation 보정·리사이즈)된 이미지 버퍼 */
    buffer: Buffer;
    /** 검증된 실제 포맷 */
    format: ImageFormat;
    /** 저장 시 사용할 확장자 */
    ext: string;
};

type NormalizeOptions = {
    /** 가장 긴 변 기준 최대 픽셀. 기본 1024 (비율 유지, 확대 안 함) */
    maxDimension?: number;
};

/**
 * 업로드된 이미지의 실제 바이트를 검증하고 정규화합니다.
 * - 클라이언트 mimetype을 신뢰하지 않고 sharp로 실제 포맷을 판별 (png/jpeg/webp만 허용)
 * - 재인코딩으로 EXIF(GPS 등 개인정보) 제거, orientation 보정, 과대 이미지 축소
 * @throws AppError(INVALID_FILE_TYPE, 400) 디코딩 실패 또는 비허용 포맷
 */
export const validateAndNormalizeImage = async (
    buffer: Buffer,
    options: NormalizeOptions = {},
): Promise<NormalizedImage> => {
    const { maxDimension = 1024 } = options;
    const image = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS });

    let format: string | undefined;
    try {
        format = (await image.metadata()).format;
    } catch {
        throw new AppError(ErrorCode.INVALID_FILE_TYPE, '유효한 이미지 파일이 아닙니다.', StatusCodes.BAD_REQUEST);
    }

    const ext = format ? ALLOWED_IMAGE_FORMATS[format] : undefined;
    if (!ext) {
        throw new AppError(ErrorCode.INVALID_FILE_TYPE, '지원하지 않는 이미지 형식입니다. (png, jpeg, webp만 허용)', StatusCodes.BAD_REQUEST);
    }

    let normalized: Buffer;
    try {
        normalized = await image
            .rotate() // EXIF orientation을 픽셀에 반영(눕는 사진 방지) 후 방향 태그 제거
            .resize(maxDimension, maxDimension, { fit: 'inside', withoutEnlargement: true })
            .toFormat(format as ImageFormat)
            .toBuffer();
    } catch {
        throw new AppError(ErrorCode.INVALID_FILE_TYPE, '이미지 처리에 실패했습니다.', StatusCodes.BAD_REQUEST);
    }

    return { buffer: normalized, format: format as ImageFormat, ext };
};

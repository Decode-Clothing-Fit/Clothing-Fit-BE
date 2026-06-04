import { PutObjectCommand } from "@aws-sdk/client-s3";
import { uuidv7 } from "uuidv7";
import sharp from "sharp";
import prisma from "@/lib/prisma/extensions";
import { AppError } from "@/common/errors/app-error";
import { ErrorCode } from "@/common/errors/error-code";
import { s3Client, S3_BUCKET } from "@/lib/storage/s3";
import { env } from "@/config/env";

// 실제 이미지 바이트로 검증되는 허용 포맷 (sharp metadata.format → 확장자)
const ALLOWED_IMAGE_FORMATS: Record<string, string> = {
    png: 'png',
    jpeg: 'jpg',
    webp: 'webp',
};

export type UserAvatar = {
    imageUrl: string;
}

/**
 * 사용자의 아바타(업로드 사진 또는 캐릭터 이미지)를 조회합니다.
 * UserCharacter는 imageUrl(업로드)과 characterId(캐릭터) 중 하나만 가지므로,
 * imageUrl이 없으면 연결된 Character의 이미지를 사용합니다. (관계 조인으로 단일 쿼리 처리)
 * @param userId
 **/
export const getUserAvatar = async (userId: string): Promise<UserAvatar> => {
    const userCharacter = await prisma.userCharacter.findUnique({
        where: { userId },
        select: {
            imageUrl: true,
            character: {
                select: { imageUrl: true },
            },
        },
    });

    if (!userCharacter) {
        throw new AppError(ErrorCode.CHARACTER_NOT_FOUND, '사용자의 아바타를 찾을 수 없습니다.', 404);
    }

    // 업로드 이미지가 있으면 그것을, 없으면 연결된 캐릭터의 이미지를 사용
    const imageUrl = userCharacter.imageUrl ?? userCharacter.character?.imageUrl;

    if (!imageUrl) {
        throw new AppError(ErrorCode.CHARACTER_NOT_FOUND, '아바타 이미지가 존재하지 않습니다.', 404);
    }

    return {
        imageUrl,
    };
}


/**
 * 사용자의 아바타를 지정한 캐릭터로 변경합니다.
 * 캐릭터로 전환하므로 sourceType=CHARACTER, characterId 설정, 업로드 이미지(imageUrl)는 제거합니다.
 * @param userId
 * @param characterId 변경할 캐릭터 ID
 **/
export const updateUserAvatar = async (userId: string, characterId: string): Promise<UserAvatar> => {
    const character = await prisma.character.findUnique({
        where: { id: characterId },
        select: { imageUrl: true },
    });

    if (!character) {
        throw new AppError(ErrorCode.CHARACTER_NOT_FOUND, '캐릭터를 찾을 수 없습니다.', 404);
    }

    const { count } = await prisma.userCharacter.updateMany({
        where: { userId },
        data: {
            sourceType: 'CHARACTER',
            characterId,
            imageUrl: null,
        },
    });
    if (count === 0) {
        throw new AppError(ErrorCode.CHARACTER_NOT_FOUND, '사용자의 아바타를 찾을 수 없습니다.', 404);
    }

    return { imageUrl: character.imageUrl };
}

/**
 * 사용자가 업로드한 사진으로 아바타를 변경합니다.
 * 실제 이미지 바이트를 검증(sharp)하고, 사용자 존재를 확인한 뒤 S3에 업로드합니다.
 * sourceType=UPLOAD, imageUrl 설정, characterId는 제거합니다.
 * @param userId
 * @param buffer 업로드된 이미지 버퍼 (multer memoryStorage)
 **/
export const updateUserAvatarImage = async (userId: string, buffer: Buffer): Promise<UserAvatar> => {
    // (2) 클라이언트 mimetype을 신뢰하지 않고 실제 바이트로 포맷 검증
    let format: string | undefined;
    try {
        format = (await sharp(buffer).metadata()).format;
    } catch {
        throw new AppError(ErrorCode.INVALID_FILE_TYPE, '유효한 이미지 파일이 아닙니다.', 400);
    }
    const ext = format ? ALLOWED_IMAGE_FORMATS[format] : undefined;
    if (!ext) {
        throw new AppError(ErrorCode.INVALID_FILE_TYPE, '지원하지 않는 이미지 형식입니다. (png, jpeg, webp만 허용)', 400);
    }

    // (4) S3에 올리기 전에 사용자 아바타 존재를 먼저 확인 → 업로드 orphan 방지
    const existing = await prisma.userCharacter.findUnique({
        where: { userId },
        select: { id: true },
    });
    if (!existing) {
        throw new AppError(ErrorCode.CHARACTER_NOT_FOUND, '사용자의 아바타를 찾을 수 없습니다.', 404);
    }

    const key = `avatars/${userId}/${uuidv7()}.${ext}`;
    await s3Client.send(
        new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: `image/${format}`,
        }),
    );

    const imageUrl = `https://${S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;

    await prisma.userCharacter.update({
        where: { userId },
        data: {
            sourceType: 'UPLOAD',
            imageUrl,
            characterId: null,
        },
    });

    return { imageUrl };
}
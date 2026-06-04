import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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

const S3_PUBLIC_PREFIX = `https://${S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/`;

/**
 * 저장된 imageUrl에서 우리가 관리하는 아바타 S3 객체 키를 추출합니다.
 * 우리 버킷의 'avatars/' 프리픽스 객체만 대상으로 하여, 외부 URL이나 캐릭터 이미지를 잘못 삭제하지 않도록 합니다.
 */
function extractAvatarS3Key(url: string | null | undefined): string | null {
    if (!url || !url.startsWith(S3_PUBLIC_PREFIX)) return null;
    const key = url.slice(S3_PUBLIC_PREFIX.length);
    return key.startsWith('avatars/') ? key : null;
}

/** S3 객체 삭제. 정리/보상 용도이므로 실패해도 본 작업을 막지 않도록 호출부에서 best-effort로 사용합니다. */
async function deleteS3Object(key: string): Promise<void> {
    await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
}

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

    // 캐릭터로 전환하면 기존 업로드 이미지는 사라지므로, 정리를 위해 이전 키를 미리 확보
    const existing = await prisma.userCharacter.findUnique({
        where: { userId },
        select: { imageUrl: true },
    });
    if (!existing) {
        throw new AppError(ErrorCode.CHARACTER_NOT_FOUND, '사용자의 아바타를 찾을 수 없습니다.', 404);
    }

    await prisma.userCharacter.update({
        where: { userId },
        data: {
            sourceType: 'CHARACTER',
            characterId,
            imageUrl: null,
        },
    });

    // DB 반영 성공 후 이전 업로드 객체 정리 (실패해도 본 작업엔 영향 없음)
    const oldKey = extractAvatarS3Key(existing.imageUrl);
    if (oldKey) {
        await deleteS3Object(oldKey).catch((err) => console.error('[Avatar] 이전 S3 객체 삭제 실패:', err));
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
    const image = sharp(buffer);

    let format: string | undefined;
    try {
        format = (await image.metadata()).format;
    } catch {
        throw new AppError(ErrorCode.INVALID_FILE_TYPE, '유효한 이미지 파일이 아닙니다.', 400);
    }
    const ext = format ? ALLOWED_IMAGE_FORMATS[format] : undefined;
    if (!ext) {
        throw new AppError(ErrorCode.INVALID_FILE_TYPE, '지원하지 않는 이미지 형식입니다. (png, jpeg, webp만 허용)', 400);
    }

    // EXIF(GPS 등 개인정보) 제거 + orientation 보정 + 과대 이미지 축소 후 재인코딩.
    // sharp는 기본적으로 메타데이터를 보존하지 않으므로 재인코딩만으로 EXIF가 제거됩니다.
    let normalized: Buffer;
    try {
        normalized = await image
            .rotate() // EXIF orientation을 픽셀에 반영(눕는 사진 방지) 후 방향 태그 제거
            .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
            .toFormat(format as 'png' | 'jpeg' | 'webp')
            .toBuffer();
    } catch {
        throw new AppError(ErrorCode.INVALID_FILE_TYPE, '이미지 처리에 실패했습니다.', 400);
    }

    // (4) S3에 올리기 전에 사용자 아바타 존재를 먼저 확인 → 업로드 orphan 방지
    //     기존 업로드 키도 함께 확보해 교체 후 정리에 사용
    const existing = await prisma.userCharacter.findUnique({
        where: { userId },
        select: { imageUrl: true },
    });
    if (!existing) {
        throw new AppError(ErrorCode.CHARACTER_NOT_FOUND, '사용자의 아바타를 찾을 수 없습니다.', 404);
    }
    const oldKey = extractAvatarS3Key(existing.imageUrl);

    const key = `avatars/${userId}/${uuidv7()}.${ext}`;
    await s3Client.send(
        new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: key,
            Body: normalized,
            ContentType: `image/${format}`,
        }),
    );

    const imageUrl = `${S3_PUBLIC_PREFIX}${key}`;

    try {
        await prisma.userCharacter.update({
            where: { userId },
            data: {
                sourceType: 'UPLOAD',
                imageUrl,
                characterId: null,
            },
        });
    } catch (err) {
        // DB 반영 실패 시 방금 업로드한 객체를 보상 삭제(orphan 방지) 후 원래 에러 전파
        await deleteS3Object(key).catch((e) => console.error('[Avatar] 업로드 롤백 삭제 실패:', e));
        throw err;
    }

    // DB 반영 성공 후 이전 업로드 객체 정리 (실패해도 본 작업엔 영향 없음)
    if (oldKey && oldKey !== key) {
        await deleteS3Object(oldKey).catch((err) => console.error('[Avatar] 이전 S3 객체 삭제 실패:', err));
    }

    return { imageUrl };
}
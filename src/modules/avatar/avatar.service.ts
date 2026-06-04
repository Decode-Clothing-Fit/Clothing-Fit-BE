import { Prisma, CharacterSource } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma/extensions";
import { AppError } from "@/common/errors/app-error";
import { ErrorCode } from "@/common/errors/error-code";
import { uploadAvatarImage, deleteAvatarImage } from "@/lib/storage/avatar-image";

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
        throw new AppError(ErrorCode.CHARACTER_NOT_FOUND, '사용자의 아바타를 찾을 수 없습니다.', StatusCodes.NOT_FOUND);
    }

    // 업로드 이미지가 있으면 그것을, 없으면 연결된 캐릭터의 이미지를 사용
    const imageUrl = userCharacter.imageUrl ?? userCharacter.character?.imageUrl;

    if (!imageUrl) {
        throw new AppError(ErrorCode.CHARACTER_NOT_FOUND, '아바타 이미지가 존재하지 않습니다.', StatusCodes.NOT_FOUND);
    }

    return { imageUrl };
}

/**
 * 사용자의 아바타를 지정한 캐릭터로 설정합니다. (온보딩 최초 설정·변경 공용 — upsert)
 * sourceType=CHARACTER, characterId 설정, 업로드 이미지(imageUrl)는 제거하고 기존 S3 객체를 정리합니다.
 * @param userId
 * @param characterId 설정할 캐릭터 ID
 **/
export const updateUserAvatar = async (userId: string, characterId: string): Promise<UserAvatar> => {
    const character = await prisma.character.findUnique({
        where: { id: characterId },
        select: { imageUrl: true },
    });
    if (!character) {
        throw new AppError(ErrorCode.CHARACTER_NOT_FOUND, '캐릭터를 찾을 수 없습니다.', StatusCodes.NOT_FOUND);
    }

    // 전환 후 정리를 위해 이전 업로드 이미지 URL을 미리 확보 (행이 없을 수도 있음)
    const existing = await prisma.userCharacter.findUnique({
        where: { userId },
        select: { imageUrl: true },
    });

    try {
        await prisma.userCharacter.upsert({
            where: { userId },
            update: { characterId, sourceType: CharacterSource.CHARACTER, imageUrl: null },
            create: { userId, characterId, sourceType: CharacterSource.CHARACTER },
        });
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
            throw new AppError(ErrorCode.CHARACTER_NOT_FOUND, '존재하지 않는 캐릭터입니다.', StatusCodes.NOT_FOUND);
        }
        throw err;
    }

    // 설정 성공 후 이전 업로드 S3 객체 정리 (캐릭터였으면 no-op)
    await deleteAvatarImage(existing?.imageUrl);

    return { imageUrl: character.imageUrl };
}

/**
 * 사용자가 업로드한 사진으로 아바타를 설정합니다. (온보딩 최초 설정·변경 공용 — upsert)
 * 이미지 검증·정규화·S3 업로드는 공용 헬퍼에 위임하고, sourceType=UPLOAD로 갱신합니다.
 * @param userId
 * @param buffer 업로드된 이미지 버퍼 (multer memoryStorage)
 **/
export const updateUserAvatarImage = async (userId: string, buffer: Buffer): Promise<UserAvatar> => {
    // 교체 후 정리를 위해 이전 업로드 이미지 URL을 미리 확보 (행이 없을 수도 있음)
    const existing = await prisma.userCharacter.findUnique({
        where: { userId },
        select: { imageUrl: true },
    });

    const { imageUrl } = await uploadAvatarImage(userId, buffer);

    try {
        await prisma.userCharacter.upsert({
            where: { userId },
            update: { sourceType: CharacterSource.UPLOAD, imageUrl, characterId: null },
            create: { userId, sourceType: CharacterSource.UPLOAD, imageUrl },
        });
    } catch (err) {
        // DB 반영 실패 시 방금 업로드한 객체를 보상 삭제 후 원래 에러 전파
        await deleteAvatarImage(imageUrl);
        throw err;
    }

    // DB 반영 성공 후 이전 업로드 객체 정리
    await deleteAvatarImage(existing?.imageUrl);

    return { imageUrl };
}

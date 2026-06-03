import prisma from "@/lib/prisma/extensions";
import { AppError } from "@/common/errors/app-error";
import { ErrorCode } from "@/common/errors/error-code";

export type UserAvatar = {
    imageUrl: string;
}

/****
 * 사용자의 아바타(업로드 사진 또는 캐릭터 이미지)를 조회합니다.
 * UserCharacter는 imageUrl(업로드)과 characterId(캐릭터) 중 하나만 가지므로,
 * imageUrl이 없으면 연결된 Character의 이미지를 사용합니다. (관계 조인으로 단일 쿼리 처리)
 * @param userId
 ****/
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

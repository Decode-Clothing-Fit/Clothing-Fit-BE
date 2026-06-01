import { AppError } from '@/common/errors/app-error';
import { ErrorCode } from '@/common/errors/error-code';
import { findUserById, softDeleteUser, deleteAllRefreshToken, findUserProfileById } from './user.repository';

export const deleteUser = async (userId: string):
Promise<void> => {
    const user = await findUserById(userId);

    if (!user) {
        throw new AppError(ErrorCode.USER_NOT_FOUND, '존재하지 않는 유저입니다.', 404);
    }

    await softDeleteUser(userId);
    await deleteAllRefreshToken(userId);
}

export const getUserProfile = async (userId: string) => {
    const user = await findUserProfileById(userId);

    if(!user) {
        throw new AppError(ErrorCode.USER_NOT_FOUND, '존재하지 않는 유저입니다.', 404);
    }

    return {
        nickname: user.profile?.nickname ?? null,
        imageUrl: user.profile?.imageUrl ?? null,
        postCount: user._count.posts,
        followerCount: user._count.followers,
        followingCount: user._count.following
    }
}
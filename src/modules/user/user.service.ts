import { AppError } from '@/common/errors/app-error';
import { ErrorCode } from '@/common/errors/error-code';
import { findUserById, softDeleteUser, deleteAllRefreshToken, 
    findUserProfileById, findPostsByUserId } from './user.repository';
import { buildPaginationResult } from '@/common/utils/pagination';
import type { GetUserPostsQuery } from './user.schema';

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

export const getUserPosts = async (
  targetUserId: string,
  requesterId: string,
  query: GetUserPostsQuery,
) => {
  const user = await findUserById(targetUserId);

  if (!user) {
    throw new AppError(ErrorCode.USER_NOT_FOUND, '존재하지 않는 유저입니다.', 404);
  }

  const posts = await findPostsByUserId(targetUserId, requesterId, query.cursor, query.limit);

  const items = posts.map((post) => ({
    id: post.id,
    nickname: post.user.profile?.nickname ?? null,
    imageUrl: post.closetArchive.imageUrl,
    likeCount: post._count.postLikes,
    isLiked: post.postLikes.length > 0,
    bookmarkCount: post._count.postBookmarks,
    isBookmarked: post.postBookmarks.length > 0,
  }));

  return buildPaginationResult(items, query.limit);
};
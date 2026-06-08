import { AppError } from '@/common/errors/app-error';
import { ErrorCode } from '@/common/errors/error-code';
import { StatusCodes } from 'http-status-codes';
import prisma from '@/lib/prisma/extensions';
import { buildPaginationResult } from '@/common/utils/pagination';
import type { GetUserPostsQuery } from './user.schema';

export const deleteUser = async (userId: string): Promise<void> => {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });

  if (!user) {
    throw new AppError(ErrorCode.USER_NOT_FOUND, '존재하지 않는 유저입니다.', StatusCodes.NOT_FOUND);
  }

  await prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } });
  await prisma.refreshToken.deleteMany({ where: { userId } });
};

export const getUserProfile = async (userId: string, requesterId: string) => {
  const [user, follow] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        profile: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    }),
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: requesterId, followingId: userId } },
    }),
  ]);

  if (!user) {
    throw new AppError(ErrorCode.USER_NOT_FOUND, '존재하지 않는 유저입니다.', StatusCodes.NOT_FOUND);
  }

  return {
    nickname: user.profile?.nickname ?? null,
    imageUrl: user.profile?.imageUrl ?? null,
    postCount: user._count.posts,
    followerCount: user._count.followers,
    followingCount: user._count.following,
    isFollowing: follow !== null,
  };
};

export const getUserPosts = async (
  targetUserId: string,
  requesterId: string,
  query: GetUserPostsQuery,
) => {
  const user = await prisma.user.findFirst({ where: { id: targetUserId, deletedAt: null } });

  if (!user) {
    throw new AppError(ErrorCode.USER_NOT_FOUND, '존재하지 않는 유저입니다.', StatusCodes.NOT_FOUND);
  }

  const posts = await prisma.post.findMany({
    where: { userId: targetUserId },
    orderBy: { createdAt: 'desc' },
    take: query.limit + 1,
    select: {
      id: true,
      user: {
        select: {
          profile: { select: { nickname: true } },
        },
      },
      closetArchive: { select: { imageUrl: true } },
      _count: { select: { postLikes: true, postBookmarks: true } },
      postLikes: {
        where: { userId: requesterId },
        select: { id: true },
        take: 1,
      },
      postBookmarks: {
        where: { userId: requesterId },
        select: { id: true },
        take: 1,
      },
    },
    ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
  });

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

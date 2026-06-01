import { basePrisma } from '@/lib/prisma/client';
import prisma from '@/lib/prisma/extensions'

export const findUserById = async (id: string) => {
    return basePrisma.user.findFirst({
        where: { id, deletedAt: null }
    })
}

export const softDeleteUser = async (id: string) => {
    return basePrisma.user.update({
        where: { id },
        data: { deletedAt: new Date() }
    })
}

export const deleteAllRefreshToken = async (userId: string) => {
    return basePrisma.refreshToken.deleteMany({
        where: { userId }
    })
}

export const findUserProfileById = async (id: string) => {
    return basePrisma.user.findFirst({
        where: { id, deletedAt: null},
        include: {
            profile: true,
            _count: {
                select: {
                    posts: true,
                    followers: true,
                    following: true
                },
            },
        },
    })
}

export const findPostsByUserId = async (
  targetUserId: string,
  requesterId: string,
  cursor?: string,
  limit: number = 20,
) => {
  return prisma.post.findMany({
    where: { userId: targetUserId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
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
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });
};
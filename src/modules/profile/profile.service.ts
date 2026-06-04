import prisma from '@/lib/prisma/extensions';
import { AppError } from '@/common/errors/app-error';
import { ErrorCode } from '@/common/errors/error-code';
import type { UpdateBodyInfoBody, UpdateNicknameBody,
   updateBodyInfoSchema, ProfilePostsQuery } from './profile.schema';


export const getProfile = async (userId: string) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { profile: true },
  });

  if (!user) {
    throw new AppError(ErrorCode.USER_NOT_FOUND, '존재하지 않는 유저입니다.', 404);
  }

  return {
    nickname: user.profile?.nickname ?? user.name,
    imageUrl: user.profile?.imageUrl ?? null,
    gender: user.profile?.gender ?? null,
  };
};

export const checkNickname = async (nickname: string): Promise<{ available: boolean }> => {
  const existing = await prisma.profile.findFirst({
    where: { nickname },
  });

  return { available: !existing };
};

export const updateNickname = async (userId: string, body: UpdateNicknameBody): Promise<void> => {
  const { nickname } = body;

  const existing = await prisma.profile.findFirst({
    where: { nickname, NOT: { userId } },
  });

  if (existing) {
    throw new AppError(ErrorCode.DUPLICATE_NICKNAME, '이미 사용 중인 닉네임입니다.', 409);
  }

  await prisma.profile.upsert({
    where: { userId },
    update: { nickname },
    create: { userId, nickname, gender: 'MALE' }, // gender는 온보딩에서 설정
  });
};

export const getBodyInfo = async (userId: string) => {
  const bodyInfo = await prisma.bodyInfo.findUnique({
    where: { userId },
  })

  if (!bodyInfo) {
    return {
      height: null,
      weight: null,
      chest: null,
      waist: null,
      hip: null,
      shoulder: null,
    }
  }

  const measurements = bodyInfo.measurements as {
    chest?: number;
    waist?: number;
    hip?: number;
    shoulder?: number;
    head?: number;
    footSize?: number;
  } | null;

  return {
    height: bodyInfo.height,
    weight: bodyInfo.weight,
    chest: measurements?.chest ?? null,
    waist: measurements?.waist ?? null,
    hip: measurements?.hip ?? null,
    shoulder: measurements?.shoulder ?? null,
    head: measurements?.head ?? null,
    footSize: measurements?.footSize ?? null,
  }
}

export const updateBodyInfo = async (userId: string, body: UpdateBodyInfoBody): Promise<void> => {
  const { height, weight, chest, waist, hip, shoulder } = body;

  const existing = await prisma.bodyInfo.findUnique({
    where: { userId }
  })

  const prevMeasurements = existing?.measurements as {
    chest?: number;
    waist?: number;
    hip?: number;
    shoulder?: number;
    head?: number;
    footSize?: number;
  } | null;

  const measurements = {
    chest: chest ?? prevMeasurements?.chest,
    waist: waist ?? prevMeasurements?.waist, 
    hip: hip ?? prevMeasurements?. hip, 
    shoulder: shoulder ?? prevMeasurements?.shoulder,
    head: head ?? prevMeasurements?.head,
    footSize: footSize ?? prevMeasurements?.footSize,
  };

  await prisma.bodyInfo.upsert({
    where: { userId },
    update: { height, weight, measurements },
    create: { userId, height, weight, measurements }
  })
}

// 최근 조회한 커뮤니티 목록
export const getRecentPosts = async (userId: string, query: ProfilePostsQuery) => {
  const { cursor, limit } = query;

  const views = await prisma.postView.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: {
      id: true,
      post: {
        select: {
          id: true,
          closetArchive: { select: { imageUrl: true } },
          _count: { select: { postLikes: true, postBookmarks: true } },
          postLikes: { where: { userId }, select: { id: true }, take: 1 },
          postBookmarks: { where: { userId }, select: { id: true }, take: 1 },
          user: { select: { profile: { select: { nickname: true } } } },
        },
      },
    },
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });

  const items = views.map((view) => ({
    id: view.post.id,
    cursorId: view.id,
    nickname: view.post.user.profile?.nickname ?? null,
    imageUrl: view.post.closetArchive.imageUrl,
    likeCount: view.post._count.postLikes,
    isLiked: view.post.postLikes.length > 0,
    bookmarkCount: view.post._count.postBookmarks,
    isBookmarked: view.post.postBookmarks.length > 0,
  }));

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.cursorId ?? null : null;

  return {
    data: data.map(({ cursorId, ...rest }) => rest),
    nextCursor,
    hasMore,
  };
};

// 북마크한 코디 목록
export const getBookmarkedPosts = async (userId: string, query: ProfilePostsQuery) => {
  const { cursor, limit } = query;

  const bookmarks = await prisma.postBookmark.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: {
      id: true,
      post: {
        select: {
          id: true,
          closetArchive: { select: { imageUrl: true } },
          _count: { select: { postLikes: true, postBookmarks: true } },
          postLikes: { where: { userId }, select: { id: true }, take: 1 },
          postBookmarks: { where: { userId }, select: { id: true }, take: 1 },
          user: { select: { profile: { select: { nickname: true } } } },
        },
      },
    },
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });

  const items = bookmarks.map((bookmark) => ({
    id: bookmark.post.id,
    cursorId: bookmark.id,
    nickname: bookmark.post.user.profile?.nickname ?? null,
    imageUrl: bookmark.post.closetArchive.imageUrl,
    likeCount: bookmark.post._count.postLikes,
    isLiked: bookmark.post.postLikes.length > 0,
    bookmarkCount: bookmark.post._count.postBookmarks,
    isBookmarked: bookmark.post.postBookmarks.length > 0,
  }));

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.cursorId ?? null : null;

  return {
    data: data.map(({ cursorId, ...rest }) => rest),
    nextCursor,
    hasMore,
  };
};

// 좋아요한 게시글 목록
export const getLikedPosts = async (userId: string, query: ProfilePostsQuery) => {
  const { cursor, limit } = query;

  const likes = await prisma.postLike.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: {
      id: true,
      post: {
        select: {
          id: true,
          closetArchive: { select: { imageUrl: true } },
          _count: { select: { postLikes: true, postBookmarks: true } },
          postLikes: { where: { userId }, select: { id: true }, take: 1 },
          postBookmarks: { where: { userId }, select: { id: true }, take: 1 },
          user: { select: { profile: { select: { nickname: true } } } },
        },
      },
    },
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });

  const items = likes.map((like) => ({
    id: like.post.id,
    cursorId: like.id,
    nickname: like.post.user.profile?.nickname ?? null,
    imageUrl: like.post.closetArchive.imageUrl,
    likeCount: like.post._count.postLikes,
    isLiked: like.post.postLikes.length > 0,
    bookmarkCount: like.post._count.postBookmarks,
    isBookmarked: like.post.postBookmarks.length > 0,
  }));

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.cursorId ?? null : null;

  return {
    data: data.map(({ cursorId, ...rest }) => rest),
    nextCursor,
    hasMore,
  };
};
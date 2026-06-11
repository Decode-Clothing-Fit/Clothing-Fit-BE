import type { ClothingType } from '@prisma/client';
import prisma from '@/lib/prisma/extensions';
import { buildPaginationResult } from '@/common/utils/pagination';
import type { CursorPaginationParams, CursorPaginationResult } from '@/common/utils/pagination';
import { AppError } from '@/common/errors/app-error';
import { ErrorCode } from '@/common/errors/error-code';
import { StatusCodes } from 'http-status-codes';
import { createFeedNotification } from '../notifications/notifications.service';

export type ClosetItemSummary = {
  id: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  type: ClothingType;
  size: string | null;
};

export type ClosetListItem = {
  id: string;
  title: string;
  imageUrl: string;
  modelUrl: string | null;
  createdAt: Date;
  closetItems: ClosetItemSummary[];
};

export type ClosetItemDetail = {
  id: string;
  closetArchiveId: string;
  brand: string | null;
  name: string;
  imageUrl: string | null;
  externalLink: string | null;
  type: ClothingType;
  size: string | null;
  createdAt: Date;
};

export type ClosetDetail = {
  id: string;
  title: string;
  imageUrl: string;
  modelUrl: string | null;
  isPublished: boolean;
  postId: string | null;
  closetItems: ClosetItemDetail[];
};

export const getClosets = async (
  userId: string,
  params: CursorPaginationParams,
): Promise<CursorPaginationResult<ClosetListItem>> => {
  const items = await prisma.closetArchive.findMany({
    where: { userId },
    take: params.limit + 1,
    ...(params.cursor && {
      cursor: { id: params.cursor },
      skip: 1,
    }),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      title: true,
      imageUrl: true,
      modelUrl: true,
      createdAt: true,
      closetItems: {
        select: {
          id: true,
          name: true,
          brand: true,
          imageUrl: true,
          type: true,
          size: true,
        },
      },
    },
  });

  return buildPaginationResult(items, params.limit);
};

export const getClosetDetail = async (
  userId: string,
  closetArchiveId: string,
): Promise<ClosetDetail> => {
  const archive = await prisma.closetArchive.findUnique({
    where: { id: closetArchiveId },
    select: {
      id: true,
      userId: true,
      title: true,
      imageUrl: true,
      modelUrl: true,
      post: { select: { id: true } },
      closetItems: {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          closetArchiveId: true,
          brand: true,
          name: true,
          imageUrl: true,
          externalLink: true,
          type: true,
          size: true,
          createdAt: true,
        },
      },
    },
  });

  if (!archive) {
    throw new AppError(ErrorCode.CLOSET_NOT_FOUND, '존재하지 않는 옷장입니다.', 404);
  }

  if (archive.userId !== userId) {
    throw new AppError(ErrorCode.NOT_CLOSET_OWNER, '접근 권한이 없습니다.', 403);
  }

  return {
    id: archive.id,
    title: archive.title,
    imageUrl: archive.imageUrl,
    modelUrl: archive.modelUrl,
    isPublished: archive.post !== null,
    postId: archive.post?.id ?? null,
    closetItems: archive.closetItems,
  };
};

export const deleteCloset = async (userId: string, closetArchiveId: string): Promise<void> => {
  const archive = await prisma.closetArchive.findUnique({
    where: { id: closetArchiveId },
    select: {
      userId: true,
      post: { select: { id: true } },
    },
  });

  if (!archive) {
    throw new AppError(ErrorCode.CLOSET_NOT_FOUND, '존재하지 않는 옷장입니다.', StatusCodes.NOT_FOUND);
  }

  if (archive.userId !== userId) {
    throw new AppError(ErrorCode.NOT_CLOSET_OWNER, '접근권한이 없습니다.', StatusCodes.FORBIDDEN);
  }

  // 트랜잭션으로 묶어 중간 실패 시 상태 불일치 방지
  await prisma.$transaction(async (tx) => {
    if (archive.post) {
      const postId = archive.post.id;
      // 연관 데이터 하드딜리트 (법적 기록 불필요)
      await tx.postView.deleteMany({ where: { postId } });
      await tx.postLike.deleteMany({ where: { postId } });
      await tx.postBookmark.deleteMany({ where: { postId } });
      // 게시글 소프트딜리트 + closetArchiveId null (법적 기록 보존, FK 참조 해제)
      await tx.post.update({
        where: { id: postId },
        data: { deletedAt: new Date(), closetArchiveId: null },
      });
    }

    await tx.closetItem.deleteMany({ where: { closetArchiveId } });
    await tx.closetArchive.delete({ where: { id: closetArchiveId } });
  });
}

export const publishCloset = async (userId: string, closetArchiveId: string): Promise<void> => {
  const archive = await prisma.closetArchive.findUnique({
    where: { id: closetArchiveId },
    select: {
      userId: true,
      post: { select: { id: true } },
    },
  });

  if (!archive) {
    throw new AppError(ErrorCode.CLOSET_NOT_FOUND, '존재하지 않는 옷장입니다.', StatusCodes.NOT_FOUND);
  }

  if (archive.userId !== userId) {
    throw new AppError(ErrorCode.NOT_CLOSET_OWNER, '접근 권한이 없습니다.', StatusCodes.FORBIDDEN);
  }

  if (archive.post) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, '이미 게시된 코디입니다.', StatusCodes.CONFLICT);
  }

  const post = await prisma.post.create({
    data: {
      userId,
      closetArchiveId,
    },
    select: { id: true },
  });

  createFeedNotification({ actorId: userId, postId: post.id })
};
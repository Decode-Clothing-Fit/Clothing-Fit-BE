import type { ClothingType } from '@prisma/client';
import prisma from '@/lib/prisma/extensions';
import { buildPaginationResult } from '@/common/utils/pagination';
import type { CursorPaginationParams, CursorPaginationResult } from '@/common/utils/pagination';
import { AppError } from '@/common/errors/app-error';
import { ErrorCode } from '@/common/errors/error-code';
import { StatusCodes } from 'http-status-codes';

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
    closetItems: archive.closetItems,
  };
};

export const deleteCloset = async (userId: string, closetArchiveId: string): Promise<void> => {
  const archive = await prisma.closetArchive.findUnique({
    where: { id: closetArchiveId },
    select: {
      userId: true,
      post: { select: { id: true }}
    }
  })

  if (!archive) {
    throw new AppError(ErrorCode.CLOSET_NOT_FOUND, ' 존재하지 않는 옷장입니다.', StatusCodes.NOT_FOUND)
  }

  if (archive.userId !== userId) {
    throw new AppError(ErrorCode.NOT_CLOSET_OWNER, '접근권한이 없습니다.', StatusCodes.FORBIDDEN);
  }

  if (archive.post) {
    await prisma.post.delete({ where: {
      id:archive.post.id
    }})
  }

  await prisma.closetItem.deleteMany({
    where: { closetArchiveId }
  })

  await prisma.closetArchive.delete({
    where: { id: closetArchiveId }
  })
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

  await prisma.post.create({
    data: {
      userId,
      closetArchiveId,
    },
  });
};
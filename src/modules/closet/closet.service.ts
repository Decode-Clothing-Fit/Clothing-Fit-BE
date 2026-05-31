import type { ClothingType } from '@prisma/client';
import prisma from '@/lib/prisma/extensions';
import { buildPaginationResult } from '@/common/utils/pagination';
import type { CursorPaginationParams, CursorPaginationResult } from '@/common/utils/pagination';
import { AppError } from '@/common/errors/app-error';
import { ErrorCode } from '@/common/errors/error-code';

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
    orderBy: { createdAt: 'desc' },
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
): Promise<ClosetItemDetail[]> => {
  const archive = await prisma.closetArchive.findUnique({
    where: { id: closetArchiveId },
    select: {
      userId: true,
      closetItems: {
        orderBy: { createdAt: 'desc' },
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

  return archive.closetItems;
};

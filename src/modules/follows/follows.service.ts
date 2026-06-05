import { buildPaginationResult } from '@/common/utils/pagination';
import type {
  FollowsPaginationQuery,
  FollowListResponse,
  FollowUserItem,
  FollowToggleResponse,
} from './follows.schema';
import prisma from '@/lib/prisma/extensions';
import { AppError } from '@/common/errors/app-error';
import { ErrorCode } from '@/common/errors/error-code';
import { StatusCodes } from 'http-status-codes';
import { UserWithProfile } from './follows.types';
import { Prisma } from '@prisma/client';
import { createFollowNotification } from '../notifications/notifications.service';

async function ensureUserExists(userId: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true },
  });
  if (!user) throw new AppError(ErrorCode.USER_NOT_FOUND, '사용자를 찾을 수 없습니다.', StatusCodes.NOT_FOUND);
}

async function getFollowingSet(currentUserId: string, targetUserIds: string[]): Promise<Set<string>> {
  if (targetUserIds.length === 0) return new Set();
  const rows = await prisma.follow.findMany({
    where: { followerId: currentUserId, followingId: { in: targetUserIds } },
    select: { followingId: true },
  });
  return new Set(rows.map((r) => r.followingId));
}

async function toFollowItems(
  others: UserWithProfile[],
  currentUserId: string,
): Promise<FollowUserItem[]> {
  const followingSet = await getFollowingSet(currentUserId, others.map((u) => u.id));
  return others.map((u) => ({
    id: u.id,
    imageUrl: u.profile?.imageUrl ?? null,
    nickname: u.profile?.nickname ?? '',
    isFollowing: u.id === currentUserId ? false : followingSet.has(u.id),
  }));
}

export async function getFollowersService(
  targetUserId: string,
  currentUserId: string,
  query: FollowsPaginationQuery,
): Promise<FollowListResponse> {
  await ensureUserExists(targetUserId);

  const { cursor, limit } = query;
  const where = { followingId: targetUserId }; // 나를 following 하는 사람들

  const [totalCount, records] = await Promise.all([
    prisma.follow.count({ where }),
    prisma.follow.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { follower: { include: { profile: true } } },
    }),
  ]);

  const { data: pageRecords, nextCursor, hasMore } = buildPaginationResult(records, limit);
  const data = await toFollowItems(pageRecords.map((r) => r.follower), currentUserId);

  return { totalCount, data, nextCursor, hasMore };
}

export async function getFollowingsService(
  targetUserId: string,
  currentUserId: string,
  query: FollowsPaginationQuery,
): Promise<FollowListResponse> {
  await ensureUserExists(targetUserId);

  const { cursor, limit } = query;
  const where = { followerId: targetUserId }; // 내가 follow 하는 사람들

  const [totalCount, records] = await Promise.all([
    prisma.follow.count({ where }),
    prisma.follow.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { following: { include: { profile: true } } },
    }),
  ]);

  const { data: pageRecords, nextCursor, hasMore } = buildPaginationResult(records, limit);
  const data = await toFollowItems(pageRecords.map((r) => r.following), currentUserId);

  return { totalCount, data, nextCursor, hasMore };
}

export async function followUserService(targetUserId: string, currentUserId: string): Promise<FollowToggleResponse> {
  if (targetUserId === currentUserId) {
    throw new AppError(ErrorCode.SELF_FOLLOW_NOT_ALLOWED, '자기 자신은 팔로우할 수 없습니다.', StatusCodes.BAD_REQUEST);
  }
  await ensureUserExists(targetUserId);

  let isNewFollow = false;
  try {
    await prisma.follow.create({
      data: { followerId: currentUserId, followingId: targetUserId },
    });
    isNewFollow = true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      isNewFollow = false;
    } else {
      throw e;
    }
  }

  if (isNewFollow) {
    const actor = await prisma.profile.findUnique({
      where: { userId: currentUserId },
      select: { nickname: true },
    });
    await createFollowNotification({
      receiverId: targetUserId,
      actorId: currentUserId,
      actorNickname: actor?.nickname ?? '?',
    });
  }

  const followerCount = await prisma.follow.count({ where: { followingId: targetUserId } });
  return { isFollowing: true, followerCount };
}

export async function unfollowUserService(targetUserId: string, currentUserId: string): Promise<FollowToggleResponse> {
  await prisma.follow.deleteMany({
    where: { followerId: currentUserId, followingId: targetUserId },
  });

  const followerCount = await prisma.follow.count({ where: { followingId: targetUserId } });
  return { isFollowing: false, followerCount };
}
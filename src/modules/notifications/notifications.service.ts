import { EventEmitter } from 'node:events';
import prisma from '@/lib/prisma/extensions';
import { buildPaginationResult } from '@/common/utils/pagination';
import { NotificationType } from '@prisma/client';
import type {
  GetNotificationsQuery,
  GetNotificationsResponse,
  NotificationDto,
  NotificationSettingsResponse,
  UpdateNotificationSettingsBody,
} from './notifications.schema';
import { CreateNotificationInput, RawNotification } from './notifications.types';
import { ErrorCode } from '@/common/errors/error-code';
import { AppError } from '@/common/errors/app-error';
import { StatusCodes } from 'http-status-codes';

// SSE 이벤트 허브
export const notificationEmitter = new EventEmitter();
notificationEmitter.setMaxListeners(0);

const userChannel = (userId: string) => `user:${userId}`;

// 알림 객체 형태로 변환
export const toNotificationDto = (
  n: RawNotification,
  refs: { post?: { id: string; image: string | null } | null } = {},
): NotificationDto => {
  const actor = n.actor
    ? { id: n.actor.id, nickname: n.actor.profile?.nickname ?? null }
    : null;

  const isActorType =
    n.type === 'LIKE' || n.type === 'FOLLOW' || n.type === 'FEED_FROM_FOLLOWING';
  const isPostType = n.type === 'LIKE' || n.type === 'FEED_FROM_FOLLOWING';
  const isArchiveType =
    n.type === 'FIT_2D_COMPLETE' || n.type === 'FIT_3D_COMPLETE';

  return {
    id: n.id,
    type: n.type,
    message: n.message,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
    actor: isActorType ? actor : null,
    post: isPostType ? refs.post ?? null : null,
    closetArchive: isArchiveType && n.targetId ? { id: n.targetId } : null,
  };
};

// 조회
export const getNotifications = async (
  userId: string,
  query: GetNotificationsQuery,
): Promise<GetNotificationsResponse> => {
  const { cursor, limit } = query;

  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { receiverId: userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        actor: { select: { id: true, profile: { select: { nickname: true } } } },
      },
    }),
    prisma.notification.count({
      where: { receiverId: userId, isRead: false },
    }),
  ]);

  const { data, nextCursor, hasMore } = buildPaginationResult(rows, limit);

  // targetId 타입별로 한 번씩 배치 로드
  const postIds = data
    .filter((n) => n.type === 'LIKE' || n.type === 'FEED_FROM_FOLLOWING')
    .map((n) => n.targetId)
    .filter((id): id is string => Boolean(id));

  const posts = postIds.length
    ? await prisma.post.findMany({
        where: { id: { in: postIds } },
        select: {
          id: true,
          postImages: { orderBy: { order: 'asc' }, take: 1, select: { imageUrl: true } },
        },
      })
    : [];

  const postMap = new Map(
    posts.map((p) => [p.id, { id: p.id, image: p.postImages[0]?.imageUrl ?? null }]),
  );

  return {
    unreadCount,
    data: data.map((it) => toNotificationDto(it, {
      post: it.targetId ? postMap.get(it.targetId) ?? null : null,
    })),
    nextCursor,
    hasMore,
  };
};

// 전체 알림 읽음
export const markAllAsRead = async (userId: string): Promise<void> => {
  await prisma.notification.updateMany({
    where: { receiverId: userId, isRead: false },
    data: { isRead: true },
  });
};

// 알림 설정 조회
export const getSettings = async (
  userId: string,
): Promise<NotificationSettingsResponse> => {
  const setting = await prisma.notificationSetting.findUnique({
    where: { userId },
  });

  if (!setting) {
    throw new AppError(ErrorCode.NOTIFICATION_SETTING_NOT_FOUND, '해당 유저의 알림 설정 정보가 존재하지 않습니다.', StatusCodes.INTERNAL_SERVER_ERROR);
  }

  return { enabled: setting.pushEnabled };
};

// 알림 설정 변경
export const updateSettings = async (
  userId: string,
  body: UpdateNotificationSettingsBody,
): Promise<NotificationSettingsResponse> => {
  const setting = await prisma.notificationSetting.upsert({
    where: { userId },
    create: { userId, pushEnabled: body.enabled },
    update: { pushEnabled: body.enabled },
  });
  return { enabled: setting.pushEnabled };
};

// 알림 전체 삭제
export const deleteAll = async (userId: string): Promise<void> => {
  await prisma.notification.deleteMany({
    where: { receiverId: userId },
  });
};

// 알림 개별 삭제
export const deleteOne = async (userId: string, id: string): Promise<void> => {
  await prisma.notification.deleteMany({
    where: { id, receiverId: userId },
  });
};

// 알림 생성 서비스
const createNotification = async (
  input: CreateNotificationInput,
): Promise<void> => {
  const created = await prisma.notification.create({
    data: {
      receiverId: input.receiverId,
      type: input.type,
      message: input.message,
      actorId: input.actorId ?? null,
      targetId: input.targetId ?? null,
    },
    include: {
      actor: { select: { id: true, profile: { select: { nickname: true } } } },
    },
  });

  const setting = await prisma.notificationSetting.findUnique({
    where: { userId: input.receiverId },
  });
  if (setting?.pushEnabled === false) return;

  let post: { id: string; image: string | null } | null = null;
  if (
    (created.type === 'LIKE' || created.type === 'FEED_FROM_FOLLOWING') &&
    created.targetId
  ) {
    const p = await prisma.post.findUnique({
      where: { id: created.targetId },
      select: {
        id: true,
        postImages: { orderBy: { order: 'asc' }, take: 1, select: { imageUrl: true } },
      },
    });
    post = p ? { id: p.id, image: p.postImages[0]?.imageUrl ?? null } : null;
  }

  notificationEmitter.emit(userChannel(input.receiverId), toNotificationDto(created, { post })); // SSE 팬아웃
};

// 좋아요 알림
export const createLikeNotification = (params: {
  receiverId: string;
  actorId: string;
  actorNickname: string;
  postId: string;
}) =>
  createNotification({
    receiverId: params.receiverId,
    type: NotificationType.LIKE,
    message: `${params.actorNickname}님이 회원님의 게시물을 좋아합니다.`,
    actorId: params.actorId,
    targetType: 'POST',
    targetId: params.postId,
  });

// 팔로우 알림
export const createFollowNotification = (params: {
  receiverId: string;
  actorId: string;
  actorNickname: string;
}) =>
  createNotification({
    receiverId: params.receiverId,
    type: NotificationType.FOLLOW,
    message: `${params.actorNickname}님이 회원님을 팔로우하기 시작했습니다.`,
    actorId: params.actorId,
    targetType: 'USER',
    targetId: params.actorId,
  });

// 팔로잉 피드 알림
export const createFeedNotification = (params: {
  receiverId: string;
  actorId: string;
  actorNickname: string;
  postId: string;
}) =>
  createNotification({
    receiverId: params.receiverId,
    type: NotificationType.FEED_FROM_FOLLOWING,
    message: `${params.actorNickname}님이 새 게시물을 올렸습니다.`,
    actorId: params.actorId,
    targetType: 'POST',
    targetId: params.postId,
  });

// 모델 완료 알림
export const createFitCompleteNotification = (params: {
  receiverId: string;
  dimension: '2D' | '3D';
  closetArchiveId: string;
}) =>
  createNotification({
    receiverId: params.receiverId,
    type:
      params.dimension === '2D'
        ? NotificationType.FIT_2D_COMPLETE
        : NotificationType.FIT_3D_COMPLETE,
    message: `${params.dimension} 피팅 모델이 완성되었습니다.`,
    targetType: 'CLOSET_ARCHIVE',
    targetId: params.closetArchiveId,
  });
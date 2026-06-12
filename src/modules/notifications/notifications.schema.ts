import { z } from 'zod';
import { NotificationType } from '@prisma/client';

// 단일 알림
export const notificationSchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(NotificationType),
  message: z.string(),
  isRead: z.boolean(),
  createdAt: z.string(),
  actor: z.object({
    id: z.string().uuid(),
    nickname: z.string().nullable(),
    imageUrl: z.string().nullable(),
  })
  .nullable(),
  post: z.object({
    id: z.string().uuid(),
    image: z.string().nullable(),
  })
  .nullable(),
  closetArchive: z.object({
    id: z.string().uuid(),
  })
  .nullable(),
});
export type NotificationDto = z.infer<typeof notificationSchema>;

// 알림 목록 조회
export const getNotificationsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type GetNotificationsQuery = z.infer<typeof getNotificationsQuerySchema>;

export const getNotificationsResponseSchema = z.object({
  unreadCount: z.number().int().nonnegative(),
  data: z.array(notificationSchema),
  nextCursor: z.string().uuid().nullable(),
  hasMore: z.boolean(),
});
export type GetNotificationsResponse = z.infer<typeof getNotificationsResponseSchema>;

// 알림 설정 변경
export const updateNotificationSettingsBodySchema = z.object({
  enabled: z.boolean(),
});
export type UpdateNotificationSettingsBody = z.infer<typeof updateNotificationSettingsBodySchema>;

export const notificationSettingsResponseSchema = z.object({
  enabled: z.boolean(),
});
export type NotificationSettingsResponse = z.infer<typeof notificationSettingsResponseSchema>;

// 알림 개별 삭제
export const notificationIdParamSchema = z.object({
  id: z.string().uuid(),
});
export type NotificationIdParam = z.infer<typeof notificationIdParamSchema>;

// 알림 SSE 구독
export const notificationEventSchema = notificationSchema;
export type NotificationEvent = z.infer<typeof notificationEventSchema>;

// 기기 토큰 관련
export const registerDeviceTokenBodySchema = z.object({
  token: z.string().min(1),
});
export type RegisterDeviceTokenBody = z.infer<typeof registerDeviceTokenBodySchema>;
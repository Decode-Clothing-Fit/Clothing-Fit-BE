import { NotificationType, Prisma } from "@prisma/client";

export type CreateNotificationInput = {
  receiverId: string;
  type: NotificationType;
  message: string;
  actorId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
};

export type RawNotification = Prisma.NotificationGetPayload<{
  include: { actor: { select: { id: true; profile: { select: { nickname: true } } } } };
}>;
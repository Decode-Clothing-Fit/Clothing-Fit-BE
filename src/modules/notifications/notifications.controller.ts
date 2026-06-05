import type { Request, Response } from 'express';
import { asyncHandler } from '@/common/utils/async.handler';
import * as notificationService from './notifications.service';
import { notificationEmitter } from './notifications.service';
import type {
  GetNotificationsQuery,
  UpdateNotificationSettingsBody,
  NotificationIdParam,
  NotificationDto,
} from './notifications.schema';

// 알림 목록 조회
export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const query = req.query as unknown as GetNotificationsQuery;

  const result = await notificationService.getNotifications(userId, query);
  res.status(200).json(result);
});

// 전체 알림 읽음
export const markAllNotificationsAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  await notificationService.markAllAsRead(userId);
  res.status(204).send();
});

// 알림 설정 조회
export const getNotificationSettings = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const result = await notificationService.getSettings(userId);
  res.status(200).json(result);
});

// 알림 설정 변경
export const updateNotificationSettings = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const body = req.body as unknown as UpdateNotificationSettingsBody;

  const result = await notificationService.updateSettings(userId, body);
  res.status(200).json(result);
});

// 알림 전체 삭제
export const deleteAllNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  await notificationService.deleteAll(userId);
  res.status(204).send();
});

// 알림 개별 삭제
export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params as unknown as NotificationIdParam;

  await notificationService.deleteOne(userId, id);
  res.status(204).send();
});

// 알림 SSE 구독
export const subscribeNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  // SSE 헤더 설정
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // nginx 프록시 버퍼링 비활성
  });
  res.flushHeaders?.();

  // 연결 확인용 초기 코멘트
  res.write(': connected\n\n');

  // 이 유저 채널로 들어온 새 알림을 클라이언트로 흘려보냄
  const channel = `user:${userId}`;
  const onNotification = (dto: NotificationDto) => {
    res.write(`data: ${JSON.stringify(dto)}\n\n`);
  };
  notificationEmitter.on(channel, onNotification);

  // 일정 주기로 주석 핑을 보내 죽은 연결/프록시 타임아웃 방지
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 30_000);

  // 연결 종료 시 정리
  req.on('close', () => {
    clearInterval(heartbeat);
    notificationEmitter.off(channel, onNotification);
    res.end();
  });
});
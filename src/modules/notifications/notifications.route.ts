import {
  getNotifications,
  markAllNotificationsAsRead,
  getNotificationSettings,
  updateNotificationSettings,
  deleteAllNotifications,
  deleteNotification,
  subscribeNotifications,
  registerDeviceToken,
} from './notifications.controller';
import { authenticate } from '@/common/middleware/auth.middleware';
import { validate } from '@/common/middleware/validate.middleware';
import { type Router as RouterType, Router } from 'express';
import { getNotificationsQuerySchema, notificationIdParamSchema, registerDeviceTokenBodySchema, updateNotificationSettingsBodySchema } from './notifications.schema';

const router: RouterType = Router();

// 기기 토큰 등록
router.post('/device-tokens', authenticate, validate({ body: registerDeviceTokenBodySchema }), registerDeviceToken);

// 알림 SSE 구독
router.get('/stream', authenticate, subscribeNotifications);

// 알림 목록 조회
router.get('/', authenticate, validate({ query: getNotificationsQuerySchema }), getNotifications);

// 전체 알림 읽음
router.patch('/read-all', authenticate, markAllNotificationsAsRead);

// 알림 설정 조회
router.get('/settings', authenticate, getNotificationSettings);

// 알림 설정 변경
router.patch('/settings', authenticate, validate({ body: updateNotificationSettingsBodySchema }), updateNotificationSettings);

// 알림 전체 삭제
router.delete('/', authenticate, deleteAllNotifications);

// 알림 개별 삭제
router.delete('/:id', authenticate, validate({ params: notificationIdParamSchema }), deleteNotification);

export default router;
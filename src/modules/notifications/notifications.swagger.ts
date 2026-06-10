import { registry } from '@/config/registry';
import {
  notificationSchema,
  getNotificationsQuerySchema,
  getNotificationsResponseSchema,
  updateNotificationSettingsBodySchema,
  notificationSettingsResponseSchema,
  notificationIdParamSchema,
  registerDeviceTokenBodySchema,
} from './notifications.schema';

export const notificationRegistry = registry;

const TAG = 'Notification';

const security = [{ bearerAuth: [] }];

notificationRegistry.registerPath({
  method: 'post',
  path: '/notifications/device-tokens',
  tags: [TAG],
  summary: '기기 푸시 토큰 등록',
  description:
    '푸시 알림 수신을 위한 Expo push token을 등록합니다. 같은 토큰 재등록 시 멱등하게 갱신되며, 한 유저가 여러 기기를 등록할 수 있습니다.',
  security,
  request: {
    body: {
      content: {
        'application/json': {
          schema: registerDeviceTokenBodySchema,
        },
      },
    },
  },
  responses: {
    204: { description: '등록 완료' },
    400: { description: '잘못된 요청 본문' },
    401: { description: '인증 실패' },
  },
});

notificationRegistry.registerPath({
  method: 'get',
  path: '/notifications/stream',
  tags: [TAG],
  summary: '알림 SSE 구독',
  description:
    '실시간 알림을 받기 위한 SSE(text/event-stream) 연결을 엽니다. 새 알림이 생기면 단일 알림 객체가 `data:` 이벤트로 전송됩니다.',
  security,
  responses: {
    200: {
      description: 'SSE 스트림 연결 성공',
      content: {
        'text/event-stream': {
          schema: notificationSchema.openapi('NotificationEvent'),
        },
      },
    },
    401: { description: '인증 실패' },
  },
});

notificationRegistry.registerPath({
  method: 'get',
  path: '/notifications',
  tags: [TAG],
  summary: '알림 목록 조회',
  description: '커서 기반 페이지네이션으로 알림 목록과 안읽은 개수를 조회합니다.',
  security,
  request: {
    query: getNotificationsQuerySchema,
  },
  responses: {
    200: {
      description: '알림 목록',
      content: {
        'application/json': {
          schema: getNotificationsResponseSchema.openapi('GetNotificationsResponse'),
        },
      },
    },
    400: { description: '잘못된 쿼리 파라미터' },
    401: { description: '인증 실패' },
  },
});

notificationRegistry.registerPath({
  method: 'patch',
  path: '/notifications/read-all',
  tags: [TAG],
  summary: '전체 알림 읽음',
  description: '안읽은 알림을 모두 읽음 처리합니다.',
  security,
  responses: {
    204: { description: '읽음 처리 완료 (응답 본문 없음)' },
    401: { description: '인증 실패' },
  },
});

notificationRegistry.registerPath({
  method: 'get',
  path: '/notifications/settings',
  tags: [TAG],
  summary: '알림 설정 조회',
  description: '유저의 알림 설정(전체 켜기/끄기)을 조회합니다.',
  security,
  responses: {
    200: {
      description: '알림 설정',
      content: {
        'application/json': {
          schema: notificationSettingsResponseSchema.openapi('NotificationSettingsResponse'),
        },
      },
    },
    401: { description: '인증 실패' },
    500: { description: '알림 설정 정보가 존재하지 않음 (데이터 정합성 오류)' },
  },
});

notificationRegistry.registerPath({
  method: 'patch',
  path: '/notifications/settings',
  tags: [TAG],
  summary: '알림 설정 변경',
  description: '알림 설정(전체 켜기/끄기)을 변경합니다.',
  security,
  request: {
    body: {
      content: {
        'application/json': {
          schema: updateNotificationSettingsBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '변경된 알림 설정',
      content: {
        'application/json': {
          schema: notificationSettingsResponseSchema,
        },
      },
    },
    400: { description: '잘못된 요청 본문' },
    401: { description: '인증 실패' },
  },
});

notificationRegistry.registerPath({
  method: 'delete',
  path: '/notifications',
  tags: [TAG],
  summary: '알림 전체 삭제',
  description: '유저의 모든 알림을 삭제합니다.',
  security,
  responses: {
    204: { description: '삭제 완료 (응답 본문 없음)' },
    401: { description: '인증 실패' },
  },
});

notificationRegistry.registerPath({
  method: 'delete',
  path: '/notifications/{id}',
  tags: [TAG],
  summary: '알림 개별 삭제',
  description: '특정 알림을 삭제합니다. 이미 없는 알림이어도 멱등하게 성공 처리됩니다.',
  security,
  request: {
    params: notificationIdParamSchema,
  },
  responses: {
    204: { description: '삭제 완료 (응답 본문 없음)' },
    400: { description: '잘못된 알림 id' },
    401: { description: '인증 실패' },
  },
});
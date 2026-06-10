// lib/expo-push/index.ts
import axios from 'axios';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export type ExpoPushMessage = {
  to: string; // ExponentPushToken[...]
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

// Expo가 응답으로 주는 티켓
type ExpoPushTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };

// 전송 결과 중 "더 이상 유효하지 않은 토큰"만 추려 반환
export const sendExpoPush = async (
  messages: ExpoPushMessage[],
): Promise<{ invalidTokens: string[] }> => {
  if (!messages.length) return { invalidTokens: [] };

  const invalidTokens: string[] = [];

  // 100개씩 청크
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await axios.post<{ data: ExpoPushTicket[] }>(EXPO_PUSH_URL, chunk, {
        headers: { 'Content-Type': 'application/json' },
      });

      res.data.data.forEach((ticket, idx) => {
        if (
          ticket.status === 'error' &&
          ticket.details?.error === 'DeviceNotRegistered'
        ) {
          invalidTokens.push(chunk[idx].to); // 죽은 토큰 수집
        }
      });
    } catch (e) {
      // 네트워크 등 전송 실패는 푸시를 포기할 뿐, 본 동작을 막지 않음
      console.error('Expo push 전송 실패', e);
    }
  }

  return { invalidTokens };
};
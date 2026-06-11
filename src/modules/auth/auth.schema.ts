import { z } from 'zod';

export const kakaoLoginSchema = z.object({
  accessToken: z.string().min(1, '카카오 액세스 토큰이 필요합니다.'),
});

export const googleLoginSchema = z.object({
  idToken: z.string().min(1, '구글 ID 토큰이 필요합니다.'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, '리프레시 토큰이 필요합니다.'),
});

export const logoutBodySchema = z.object({
  refreshToken: z.string().min(1, '리프레시 토큰이 필요합니다.'),
  deviceToken: z.string().min(1).optional(),
})
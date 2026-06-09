import { Provider } from '@prisma/client';
import { AppError } from '@/common/errors/app-error';
import { ErrorCode } from '@/common/errors/error-code';
import { StatusCodes } from 'http-status-codes';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/common/utils/jwt';
import prisma from '@/lib/prisma/extensions';
import type { GoogleUserInfo, KakaoUserInfo, SocialLoginResult } from './auth.types';
import { OAuth2Client } from 'google-auth-library';
import { env } from '@/config/env';

// ── Kakao ──────────────────────────────────────────────────────────────────

const getKakaoUserInfo = async (accessToken: string): Promise<KakaoUserInfo> => {
  const res = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
  });

  if (!res.ok) {
    throw new AppError(ErrorCode.UNAUTHORIZED, '유효하지 않은 카카오 토큰입니다.', StatusCodes.UNAUTHORIZED);
  }

  return res.json() as Promise<KakaoUserInfo>;
};

export const kakaoLogin = async (accessToken: string): Promise<SocialLoginResult> => {
  const kakaoUser = await getKakaoUserInfo(accessToken);

  const providerId = String(kakaoUser.id);
  const name = kakaoUser.kakao_account?.profile?.nickname ?? `user_${providerId}`;

  let user = await prisma.user.findFirst({ where: { provider: Provider.KAKAO, providerId } });
  let isNewUser = false;

  if (!user) {
    user = await prisma.user.create({ data: { provider: Provider.KAKAO, providerId, name } });
    isNewUser = true;
  } else if (user.deletedAt) {
    user = await prisma.user.update({ where: { id: user.id }, data: { deletedAt: null, name } });
    isNewUser = true;
  }

  const newAccessToken = signAccessToken({ userId: user.id });
  const newRefreshToken = signRefreshToken({ userId: user.id });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.refreshToken.create({ data: { token: newRefreshToken, userId: user.id, expiresAt } });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken, isNewUser };
};

// ── Google ─────────────────────────────────────────────────────────────────

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

const getGoogleUserInfo = async (idToken: string): Promise<GoogleUserInfo> => {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload) {
    throw new AppError(ErrorCode.UNAUTHORIZED, '유효하지 않은 구글 토큰입니다.', StatusCodes.UNAUTHORIZED);
  }

  return {
    sub: payload.sub,
    name: payload.name ?? `user_${payload.sub}`,
    email: payload.email,
    picture: payload.picture,
  };
};

export const googleLogin = async (idToken: string): Promise<SocialLoginResult> => {
  const googleUser = await getGoogleUserInfo(idToken);

  const providerId = googleUser.sub;
  const name = googleUser.name;

  let user = await prisma.user.findFirst({ where: { provider: Provider.GOOGLE, providerId } });
  let isNewUser = false;

  if (!user) {
    user = await prisma.user.create({ data: { provider: Provider.GOOGLE, providerId, name } });
    isNewUser = true;
  } else if (user.deletedAt) {
    user = await prisma.user.update({ where: { id: user.id }, data: { deletedAt: null, name } });
    isNewUser = true;
  }

  const newAccessToken = signAccessToken({ userId: user.id });
  const newRefreshToken = signRefreshToken({ userId: user.id });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.refreshToken.create({ data: { token: newRefreshToken, userId: user.id, expiresAt } });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken, isNewUser };
};

// ── Token ──────────────────────────────────────────────────────────────────

export const logout = async (refreshToken: string, requesterId: string): Promise<void> => {
  const token = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });

  if (!token) {
    throw new AppError(ErrorCode.INVALID_TOKEN, '유효하지 않은 리프레시 토큰입니다.', StatusCodes.UNAUTHORIZED);
  }

  // 본인 토큰인지 확인
  if (token.userId !== requesterId) {
    throw new AppError(ErrorCode.UNAUTHORIZED, '권한이 없습니다.', StatusCodes.UNAUTHORIZED);
  }

  await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
};

export const refresh = async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> => {
  // JWT 서명 먼저 검증
  try {
    verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(ErrorCode.INVALID_TOKEN, '유효하지 않은 리프레시 토큰입니다.', StatusCodes.UNAUTHORIZED);
  }

  const token = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });

  if (!token) {
    throw new AppError(ErrorCode.INVALID_TOKEN, '유효하지 않은 리프레시 토큰입니다.', StatusCodes.UNAUTHORIZED);
  }

  if (token.expiresAt < new Date()) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    throw new AppError(ErrorCode.TOKEN_EXPIRED, '리프레시 토큰이 만료되었습니다.', StatusCodes.UNAUTHORIZED);
  }

  // Refresh Token Rotation: 기존 토큰 삭제 후 새 토큰 발급
  const newAccessToken = signAccessToken({ userId: token.userId });
  const newRefreshToken = signRefreshToken({ userId: token.userId });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await prisma.refreshToken.deleteMany({ where: { userId: token.userId } });
  await prisma.refreshToken.create({ data: { token: newRefreshToken, userId: token.userId, expiresAt } });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

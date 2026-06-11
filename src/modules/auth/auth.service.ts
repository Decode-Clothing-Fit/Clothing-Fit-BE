import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { Gender, Prisma, Provider } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '@/common/errors/app-error';
import { ErrorCode } from '@/common/errors/error-code';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/common/utils/jwt';
import prisma from '@/lib/prisma/extensions';
import type { GoogleUserInfo, KakaoUserInfo, SocialLoginResult } from './auth.types';
import { env } from '@/config/env';
import { removeDeviceToken } from '../notifications/notifications.service';

const RECOVERY_DAYS = 7;

// ── Profile ────────────────────────────────────────────────────────────────

/**
 * 신규 유저 기본 프로필 생성
 * - 닉네임 중복 시 P2002를 캐치하고 이름_랜덤4자리로 재시도 (최대 5회)
 * - findFirst + upsert 패턴의 race condition 방지
 */
const createDefaultProfile = async (userId: string, name: string, imageUrl: string | null): Promise<void> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const nickname = attempt === 0 ? name : `${name}_${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      await prisma.profile.upsert({
        where: { userId },
        update: {},
        create: { userId, nickname, imageUrl, gender: Gender.MALE },
      });
      return;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        continue; // 닉네임 충돌 → 다음 시도에서 랜덤 접미사 사용
      }
      throw e;
    }
  }
  throw new AppError(ErrorCode.INTERNAL_ERROR, '닉네임 생성에 실패했습니다.', StatusCodes.INTERNAL_SERVER_ERROR);
};

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
    const daysSinceDelete = (Date.now() - user.deletedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDelete > RECOVERY_DAYS) {
      throw new AppError(ErrorCode.USER_NOT_FOUND, '탈퇴한 지 7일이 지나 복구할 수 없습니다.', StatusCodes.GONE);
    }
    user = await prisma.user.update({ where: { id: user.id }, data: { deletedAt: null, name } });
    isNewUser = true;
  }

  // 신규 유저 기본 프로필 생성
  if (isNewUser) {
    const imageUrl = kakaoUser.kakao_account?.profile?.profile_image_url ?? null;
    await createDefaultProfile(user.id, name, imageUrl);
  }

  const newAccessToken = signAccessToken({ userId: user.id });
  const newRefreshToken = signRefreshToken({ userId: user.id });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  // 만료된 토큰만 정리 (다른 기기의 유효한 토큰은 유지)
  await prisma.refreshToken.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } });
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
    const daysSinceDelete = (Date.now() - user.deletedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDelete > RECOVERY_DAYS) {
      throw new AppError(ErrorCode.USER_NOT_FOUND, '탈퇴한 지 7일이 지나 복구할 수 없습니다.', StatusCodes.GONE);
    }
    user = await prisma.user.update({ where: { id: user.id }, data: { deletedAt: null, name } });
    isNewUser = true;
  }

  // 신규 유저 기본 프로필 생성
  if (isNewUser) {
    const imageUrl = googleUser.picture ?? null;
    await createDefaultProfile(user.id, name, imageUrl);
  }

  const newAccessToken = signAccessToken({ userId: user.id });
  const newRefreshToken = signRefreshToken({ userId: user.id });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  // 만료된 토큰만 정리 (다른 기기의 유효한 토큰은 유지)
  await prisma.refreshToken.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } });
  await prisma.refreshToken.create({ data: { token: newRefreshToken, userId: user.id, expiresAt } });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken, isNewUser };
};

// ── Token ──────────────────────────────────────────────────────────────────

export const logout = async (refreshToken: string, requesterId: string, deviceToken?: string): Promise<void> => {
  const token = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });

  if (!token) {
    throw new AppError(ErrorCode.INVALID_TOKEN, '유효하지 않은 리프레시 토큰입니다.', StatusCodes.UNAUTHORIZED);
  }

  // 본인 토큰인지 확인
  if (token.userId !== requesterId) {
    throw new AppError(ErrorCode.UNAUTHORIZED, '권한이 없습니다.', StatusCodes.UNAUTHORIZED);
  }

  await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });

  if (deviceToken) {
    await removeDeviceToken(deviceToken, token.userId);
  }
};

export const refresh = async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> => {
  // JWT 서명 및 만료 검증
  try {
    verifyRefreshToken(refreshToken);
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) {
      throw new AppError(ErrorCode.TOKEN_EXPIRED, '리프레시 토큰이 만료되었습니다.', StatusCodes.UNAUTHORIZED);
    }
    throw new AppError(ErrorCode.INVALID_TOKEN, '유효하지 않은 리프레시 토큰입니다.', StatusCodes.UNAUTHORIZED);
  }

  // 토큰 원자적 삭제 - 동시 요청 시 한 건만 성공, 나머지는 P2025로 차단
  let token;
  try {
    token = await prisma.refreshToken.delete({ where: { token: refreshToken } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw new AppError(ErrorCode.INVALID_TOKEN, '유효하지 않은 리프레시 토큰입니다.', StatusCodes.UNAUTHORIZED);
    }
    throw e;
  }

  if (token.expiresAt < new Date()) {
    throw new AppError(ErrorCode.TOKEN_EXPIRED, '리프레시 토큰이 만료되었습니다.', StatusCodes.UNAUTHORIZED);
  }

  // Refresh Token Rotation: 사용한 토큰만 삭제 후 새 토큰 발급 (다중 기기 지원)
  const newAccessToken = signAccessToken({ userId: token.userId });
  const newRefreshToken = signRefreshToken({ userId: token.userId });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await prisma.refreshToken.create({ data: { token: newRefreshToken, userId: token.userId, expiresAt } });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

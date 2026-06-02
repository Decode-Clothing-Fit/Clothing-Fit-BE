import { Provider } from '@prisma/client';
import { AppError } from '@/common/errors/app-error';
import { ErrorCode } from '@/common/errors/error-code';
import { signAccessToken, signRefreshToken } from '@/common/utils/jwt';
import { createSocialUser, saveRefreshToken,
   findRefreshToken, deleteRefreshToken, restoreSocialUser, 
   findUserByProviderIdIncludeDeleted} from './auth.repository';
import type { GoogleUserInfo, KakaoUserInfo, SocialLoginResult } from './auth.types';
import { OAuth2Client } from 'google-auth-library';
import { env } from '@/config/env';

const getKakaoUserInfo = async (accessToken: string): Promise<KakaoUserInfo> => {
  const res = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
  });

  if (!res.ok) {
    throw new AppError(ErrorCode.UNAUTHORIZED, '유효하지 않은 카카오 토큰입니다.', 401);
  }

  return res.json() as Promise<KakaoUserInfo>;
};

export const kakaoLogin = async (accessToken: string): Promise<SocialLoginResult> => {
  const kakaoUser = await getKakaoUserInfo(accessToken);

  const providerId = String(kakaoUser.id);
  const name = kakaoUser.kakao_account?.profile?.nickname ?? `user_${providerId}`;

  let user = await findUserByProviderIdIncludeDeleted(Provider.KAKAO, providerId);
  let isNewUser = false;

  if (!user) {
    user = await createSocialUser({
      provider: Provider.KAKAO,
      providerId,
      name,
    });
    isNewUser = true;
  } else if (user.deletedAt) {
    user = await restoreSocialUser(user.id, name);
    isNewUser = true;
  }

  const newAccessToken = signAccessToken({ userId: user.id });
  const newRefreshToken = signRefreshToken({ userId: user.id });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await saveRefreshToken({
    token: newRefreshToken,
    userId: user.id,
    expiresAt,
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken, isNewUser };
};

export const logout = async (refreshToken: string): Promise<void> => {
  const token = await findRefreshToken(refreshToken);

  if (!token) {
    throw new AppError(ErrorCode.INVALID_TOKEN, '유효하지 않은 리프레시 토큰입니다.', 401);
  }

  await deleteRefreshToken(refreshToken);
};

export const refresh = async (refreshToken: string): Promise<{ accessToken: string }> => {
  const token = await findRefreshToken(refreshToken);

  if (!token) {
    throw new AppError(ErrorCode.INVALID_TOKEN, '유효하지 않은 리프레시 토큰입니다.', 401);
  }

  if (token.expiresAt < new Date()) {
    throw new AppError(ErrorCode.TOKEN_EXPIRED, '리프레시 토큰이 만료되었습니다.', 401);
  }

  const newAccessToken = signAccessToken({ userId: token.userId });

  return { accessToken: newAccessToken };
};

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

const getGoogleUserInfo = async (idToken: string):
Promise<GoogleUserInfo> => {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID
  })

  const payload = ticket.getPayload();

  if (!payload) {
    throw new AppError(ErrorCode.UNAUTHORIZED, '유효하지 않은 구글 토큰입니다.', 401);
  }

  return {
    sub: payload.sub,
    name: payload.name ?? `user_${payload.sub}`,
    email: payload.email,
    picture: payload.picture
  }
}

export const googleLogin = async (idToken: string):
Promise<SocialLoginResult> => {
  const googleUser = await getGoogleUserInfo(idToken);

  const providerId = googleUser.sub;
  const name = googleUser.name;

  let user = await findUserByProviderIdIncludeDeleted(Provider.GOOGLE, providerId);
  let isNewUser = false;

  if(!user) {
    user = await createSocialUser({
      provider: Provider.GOOGLE,
      providerId,
      name
    })
    isNewUser = true;
  } else if (user.deletedAt) {
    user = await restoreSocialUser(user.id, name);
    isNewUser = true;
  }

  const newAccessToken = signAccessToken({ userId: user.id });
  const newRefreshToken = signRefreshToken({ userId: user.id });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await saveRefreshToken({
    token: newRefreshToken,
    userId: user.id,
    expiresAt
  });

  return { accessToken: newAccessToken, refreshToken:
    newRefreshToken, isNewUser
  }
}
import { Provider } from '@prisma/client';
import { AppError } from '@/common/errors/app-error';
import { ErrorCode } from '@/common/errors/error-code';
import { signAccessToken, signRefreshToken } from '@/common/utils/jwt';
import { findUserByProviderId, createSocialUser, saveRefreshToken, findRefreshToken, deleteRefreshToken } from './auth.repository';
import type { KakaoUserInfo, SocialLoginResult } from './auth.types';

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

  let user = await findUserByProviderId(Provider.KAKAO, providerId);
  let isNewUser = false;

  if (!user) {
    user = await createSocialUser({
      provider: Provider.KAKAO,
      providerId,
      name,
    });
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
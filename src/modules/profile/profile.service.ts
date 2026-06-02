import prisma from '@/lib/prisma/extensions';
import { AppError } from '@/common/errors/app-error';
import { ErrorCode } from '@/common/errors/error-code';
import type { UpdateNicknameBody } from './profile.schema';

export const getProfile = async (userId: string) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { profile: true },
  });

  if (!user) {
    throw new AppError(ErrorCode.USER_NOT_FOUND, '존재하지 않는 유저입니다.', 404);
  }

  return {
    nickname: user.profile?.nickname ?? null,
    imageUrl: user.profile?.imageUrl ?? null,
    gender: user.profile?.gender ?? null,
  };
};

export const checkNickname = async (nickname: string): Promise<{ available: boolean }> => {
  const existing = await prisma.profile.findFirst({
    where: { nickname },
  });

  return { available: !existing };
};

export const updateNickname = async (userId: string, body: UpdateNicknameBody): Promise<void> => {
  const { nickname } = body;

  const existing = await prisma.profile.findFirst({
    where: { nickname, NOT: { userId } },
  });

  if (existing) {
    throw new AppError(ErrorCode.DUPLICATE_NICKNAME, '이미 사용 중인 닉네임입니다.', 409);
  }

  await prisma.profile.upsert({
    where: { userId },
    update: { nickname },
    create: { userId, nickname, gender: 'MALE' }, // gender는 온보딩에서 설정
  });
};
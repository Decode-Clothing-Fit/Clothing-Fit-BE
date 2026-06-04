import prisma from '@/lib/prisma/extensions';
import { AppError } from '@/common/errors/app-error';
import { ErrorCode } from '@/common/errors/error-code';
import type { UpdateBodyInfoBody, UpdateNicknameBody, updateBodyInfoSchema } from './profile.schema';

export const getProfile = async (userId: string) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { profile: true },
  });

  if (!user) {
    throw new AppError(ErrorCode.USER_NOT_FOUND, '존재하지 않는 유저입니다.', 404);
  }

  return {
    nickname: user.profile?.nickname ?? user.name,
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

export const getBodyInfo = async (userId: string) => {
  const bodyInfo = await prisma.bodyInfo.findUnique({
    where: { userId },
  })

  if (!bodyInfo) {
    return {
      height: null,
      weight: null,
      chest: null,
      waist: null,
      hip: null,
      shoulder: null,
    }
  }

  const measurements = bodyInfo.measurements as {
    chest?: number;
    waist?: number;
    hip?: number;
    shoulder?: number;
    head?: number;
    footSize?: number;
  } | null;

  return {
    height: bodyInfo.height,
    weight: bodyInfo.weight,
    chest: measurements?.chest ?? null,
    waist: measurements?.waist ?? null,
    hip: measurements?.hip ?? null,
    shoulder: measurements?.shoulder ?? null,
    head: measurements?.head ?? null,
    footSize: measurements?.footSize ?? null,
  }
}

export const updateBodyInfo = async (userId: string, body: UpdateBodyInfoBody): Promise<void> => {
  const { height, weight, chest, waist, hip, shoulder } = body;

  const existing = await prisma.bodyInfo.findUnique({
    where: { userId }
  })

  const prevMeasurements = existing?.measurements as {
    chest?: number;
    waist?: number;
    hip?: number;
    shoulder?: number;
    head?: number;
    footSize?: number;
  } | null;

  const measurements = {
    chest: chest ?? prevMeasurements?.chest,
    waist: waist ?? prevMeasurements?.waist, 
    hip: hip ?? prevMeasurements?. hip, 
    shoulder: shoulder ?? prevMeasurements?.shoulder,
    head: head ?? prevMeasurements?.head,
    footSize: footSize ?? prevMeasurements?.footSize,
  };

  await prisma.bodyInfo.upsert({
    where: { userId },
    update: { height, weight, measurements },
    create: { userId, height, weight, measurements }
  })
}
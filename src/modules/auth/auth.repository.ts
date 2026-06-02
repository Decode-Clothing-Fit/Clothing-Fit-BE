import type { Provider } from '@prisma/client';
import prisma from '@/lib/prisma/extensions';

export const createSocialUser = async (data: {
  provider: Provider;
  providerId: string;
  name: string;
}) => {
  return prisma.user.create({ data });
};

export const saveRefreshToken = async (data: {
  token: string;
  userId: string;
  expiresAt: Date;
}) => {
  return prisma.refreshToken.create({ data });
};

export const deleteRefreshToken = async (token: string) => {
  return prisma.refreshToken.deleteMany({ where: { token } });
};

export const findRefreshToken = async (token: string) => {
  return prisma.refreshToken.findUnique({ where: { token } });
};

export const findUserByProviderIdIncludeDeleted = async (provider:
  Provider, providerId: string) => {
    return prisma.user.findFirst({
      where: { provider, providerId }
    })
  }

  export const restoreSocialUser = async (id: string, name: string) => {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: null, name }
    })
  }

  export const deleteRefreshTokenByUserId = async (userId: string) => {
    return prisma.refreshToken.deleteMany({ where: {userId}})
  }
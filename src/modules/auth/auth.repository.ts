import type { Provider } from '@prisma/client';
import { basePrisma } from '@/lib/prisma/client';

export const findUserByProviderId = async (provider: Provider, providerId: string) => {
  return basePrisma.user.findFirst({
    where: { provider, providerId, deletedAt: null },
  });
};

export const createSocialUser = async (data: {
  provider: Provider;
  providerId: string;
  name: string;
}) => {
  return basePrisma.user.create({ data });
};

export const saveRefreshToken = async (data: {
  token: string;
  userId: string;
  expiresAt: Date;
}) => {
  return basePrisma.refreshToken.create({ data });
};

export const deleteRefreshToken = async (token: string) => {
  return basePrisma.refreshToken.deleteMany({ where: { token } });
};

export const findRefreshToken = async (token: string) => {
  return basePrisma.refreshToken.findUnique({ where: { token } });
};
import { z } from 'zod';
import { MAX_PAGE_LIMIT } from '@/config/constants';

export const UserProfileResponseSchema = z.object({
  nickname: z.string().nullable(),
  imageUrl: z.string().nullable(),
  postCount: z.number(),
  followerCount: z.number(),
  followingCount: z.number(),
}).openapi('UserProfileResponse');

export const getUserPostsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(20),
});

export const userIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type GetUserPostsQuery = z.infer<typeof getUserPostsQuerySchema>;
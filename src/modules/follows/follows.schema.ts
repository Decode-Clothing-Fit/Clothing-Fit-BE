import { z } from 'zod';

// 요청
export const FollowParamsSchema = z.object({
  id: z.string().uuid(),
});

export const FollowsPaginationQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// 응답
export const FollowUserItemSchema = z.object({
  id: z.string().uuid(),
  imageUrl: z.string().url().nullable().openapi({ description: '프로필 이미지' }),
  nickname: z.string(),
  isFollowing: z.boolean().openapi({ description: '요청 유저의 팔로우 여부' }),
});

export const FollowListResponseSchema = z.object({
  totalCount: z.number().int(),
  data: z.array(FollowUserItemSchema),
  nextCursor: z.string().uuid().nullable(),
  hasMore: z.boolean(),
});

export const FollowToggleResponseSchema = z.object({
  isFollowing: z.boolean().openapi({ description: '팔로우 여부' }),
  followerCount: z.number().int(),
});

export type FollowParams = z.infer<typeof FollowParamsSchema>;
export type FollowsPaginationQuery = z.infer<typeof FollowsPaginationQuerySchema>;
export type FollowUserItem = z.infer<typeof FollowUserItemSchema>;
export type FollowListResponse = z.infer<typeof FollowListResponseSchema>;
export type FollowToggleResponse = z.infer<typeof FollowToggleResponseSchema>;
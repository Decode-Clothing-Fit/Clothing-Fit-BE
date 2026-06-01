import { z } from 'zod';

export const popularPostSchema = z.object({
  image: z.string().url(),
  nickname: z.string(),
  createdAt: z.string().datetime(),
  likeCount: z.number().int().nonnegative(),
  isLiked: z.boolean(),
  itemImages: z.array(z.string().url()).max(5),
});

// 인기글 목록
export const popularPostsResponseSchema = z.array(popularPostSchema).max(10);

export const recommendedInfluencerSchema = z.object({
  postImage: z.string().url().nullable(),
  profileImage: z.string().url().nullable(),
  nickname: z.string(),
  followerCount: z.number().int().nonnegative(),
  isFollowing: z.boolean(),
});

// 추천 인플루언서
export const recommendedInfluencersResponseSchema = z.array(recommendedInfluencerSchema).max(10);

// 타입 추론
export type PopularPost = z.infer<typeof popularPostSchema>;
export type PopularPostsResponse = z.infer<typeof popularPostsResponseSchema>;
export type RecommendedInfluencer = z.infer<typeof recommendedInfluencerSchema>;
export type RecommendedInfluencersResponse = z.infer<typeof recommendedInfluencersResponseSchema>;
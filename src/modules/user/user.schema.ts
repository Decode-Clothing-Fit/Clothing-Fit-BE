import { z } from 'zod';

export const UserProfileResponseSchema = z.object({
    nickname: z.string(),
    imageUrl: z.string().nullable(),
    postCount: z.number(),
    followerCount: z.number(),
    followingCount: z.number()
}).openapi('UserProfileResponse')
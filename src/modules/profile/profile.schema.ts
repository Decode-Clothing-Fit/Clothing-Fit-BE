import { MAX_PAGE_LIMIT } from '@/config/constants';
import { z } from 'zod';

export const profileResponseSchema = z.object({
    nickname: z.string().nullable(),
    imageUrl: z.string().nullable(),
    gender: z.string().nullable()
}).openapi('ProfileResponse');

export const updateNicknameSchema = z.object({
    nickname: z.string().min(1, '닉네임을 입력해주세요.').max(20, '닉네임은 20자 이하여야 합니다.')
})

export const checkNicknameSchema = z.object({
    nickname: z.string().min(1, '닉네임을 입력해주세요.')
})

export const checkNicknameResponseSchema = z.object({
    available: z.boolean()
}).openapi('CheckNicknameResponse')

export type UpdateNicknameBody = z.infer<typeof updateNicknameSchema>;
export type CheckNicknameQuery = z.infer<typeof checkNicknameSchema>;

export const bodyInfoResponseSchema = z.object({
    height: z.number().nullable(),
    weight: z.number().nullable(),
    chest: z.number().nullable(),
    waist: z.number().nullable(),
    hip: z.number().nullable(),
    shoulder: z.number().nullable(),
    head: z.number().nullable(),
    footSize: z.number().nullable(),
}).openapi('BodyInfoResponse');

export const updateBodyInfoSchema = z.object({
    height: z.number().int().min(1).max(300),
    weight: z.number().int().min(1).max(500),
    chest: z.number().int().min(1).max(300).optional(),
    waist: z.number().int().min(1).max(300).optional(),
    hip: z.number().int().min(1).max(300).optional(),
    shoulder: z.number().int().min(1).max(300).optional(),
    head: z.number().int().min(1).max(100).optional(),
    footSize: z.number().int().min(1).max(400).optional(),
})

export type UpdateBodyInfoBody = z.infer<typeof updateBodyInfoSchema>;

export const profilePostsQuerySchema = z.object({
    cursor: z.string().uuid().optional(), limit:
    z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(20)
})

export type ProfilePostsQuery = z.infer<typeof profilePostsQuerySchema>;
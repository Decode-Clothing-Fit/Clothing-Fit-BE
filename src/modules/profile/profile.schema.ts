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
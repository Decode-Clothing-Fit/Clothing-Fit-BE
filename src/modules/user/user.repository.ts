import { basePrisma } from '@/lib/prisma/client';

export const findUserById = async (id: string) => {
    return basePrisma.user.findFirst({
        where: { id, deletedAt: null }
    })
}

export const softDeleteUser = async (id: string) => {
    return basePrisma.user.update({
        where: { id },
        data: { deletedAt: new Date() }
    })
}

export const deleteAllRefreshToken = async (userId: string) => {
    return basePrisma.refreshToken.deleteMany({
        where: { userId }
    })
}

export const findUserProfileById = async (id: string) => {
    return basePrisma.user.findFirst({
        where: { id, deletedAt: null},
        include: {
            profile: true,
            _count: {
                select: {
                    posts: true,
                    followers: true,
                    following: true
                },
            },
        },
    })
}
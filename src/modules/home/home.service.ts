
import prisma from '@/lib/prisma/extensions';
import {
  PopularPostsResponse,
  RecommendedInfluencersResponse,
} from './home.schema';

// 인기글 목록 (최대 10개)
export const getPopularPostsService = async (
  userId: string,
): Promise<PopularPostsResponse> => {
  const posts = await prisma.post.findMany({
    take: 10,
    orderBy: [
      { postLikes: { _count: 'desc' } },
      { createdAt: 'desc' },
    ],
    select: {
      createdAt: true,
      closetArchive: {
        select: {
          imageUrl: true,
          closetItems: {
            take: 5,
            select: { imageUrl: true },
          },
        },
      },
      user: {
        select: {
          profile: { select: { nickname: true } },
        },
      },
      _count: { select: { postLikes: true } },
      postLikes: {
        where: { userId },
        select: { id: true },
      },
    },
  });

  return posts.map((post) => ({
    image: post.closetArchive.imageUrl,
    nickname: post.user.profile?.nickname ?? '',
    createdAt: post.createdAt.toISOString(),
    likeCount: post._count.postLikes,
    isLiked: post.postLikes.length > 0,
    itemImages: post.closetArchive.closetItems
      .map((item) => item.imageUrl)
      .filter((url): url is string => url !== null),
  }));
};

// 추천 인플루언서 (최대 10개)
export const getRecommendedInfluencersService = async (
  userId: string,
): Promise<RecommendedInfluencersResponse> => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // 1) 최근 7일간 팔로우 증가량 순으로 후보 추출
  const recentFollows = await prisma.follow.groupBy({
    by: ['followingId'],
    where: {
      createdAt: { gte: oneWeekAgo },
    },
    _count: { followingId: true },
    orderBy: { _count: { followingId: 'desc' } },
    take: 20,
  });

  const candidateIds = recentFollows.map((f) => f.followingId);
  if (candidateIds.length === 0) return [];

  // 2) 게시글 보유 유저만 + 필요한 정보 조회
  const users = await prisma.user.findMany({
    where: {
      id: { in: candidateIds },
      posts: { some: {} }, // 게시글 최소 1개
    },
    select: {
      id: true,
      profile: { select: { nickname: true, imageUrl: true } },
      _count: { select: { followers: true } },
      posts: {
        orderBy: [
          { postLikes: { _count: 'desc' } },
          { createdAt: 'desc' },
        ],
        take: 1,
        select: {
          closetArchive: { select: { imageUrl: true } },
        },
      },
      followers: {
        where: { followerId: userId },
        select: { id: true },
      },
    },
  });

  // 3) 최근 팔로우 증가량 순서 유지
  const orderMap = new Map(candidateIds.map((id, idx) => [id, idx]));
  const sorted = users.sort(
    (a, b) => orderMap.get(a.id)! - orderMap.get(b.id)!,
  );

  return sorted.slice(0, 10).map((user) => ({
    postImage: user.posts[0].closetArchive.imageUrl,
    profileImage: user.profile?.imageUrl ?? null,
    nickname: user.profile?.nickname ?? '',
    followerCount: user._count.followers,
    isFollowing: user.followers.length > 0,
  }));
};
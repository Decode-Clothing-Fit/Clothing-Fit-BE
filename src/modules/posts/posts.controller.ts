import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { bookmarkPostService, deletePostService, getPostByIdService, getPostsService, likePostService, unbookmarkPostService, unlikePostService } from './posts.service';
import type { GetPostsQuery, PostIdParam } from './posts.schema';
import { asyncHandler } from '@/common/utils/async.handler';

// 게시글 목록 조회 (필터/정렬/검색 포함)
export const getPosts = asyncHandler(async (req: Request, res: Response) => {
  const result = await getPostsService(req.query as unknown as GetPostsQuery, req.user!.id);
  res.status(StatusCodes.OK).json(result);
});

// 게시글 상세 조회
export const getPostById = asyncHandler(async (req: Request, res: Response) => {
  const result = await getPostByIdService((req.params as unknown as PostIdParam).id, req.user!.id);
  res.status(StatusCodes.OK).json(result);
});

// 게시글 삭제
export const deletePost = asyncHandler(async (req: Request, res: Response) => {
  await deletePostService((req.params as unknown as PostIdParam).id, req.user!.id);
  res.status(StatusCodes.NO_CONTENT).send();
});

// 좋아요
export const likePost = asyncHandler(async (req: Request, res: Response) => {
  const result = await likePostService(req.user!.id, (req.params as unknown as PostIdParam).id);
  res.status(StatusCodes.OK).json(result);
});

// 좋아요 취소
export const unlikePost = asyncHandler(async (req: Request, res: Response) => {
  const result = await unlikePostService(req.user!.id, (req.params as unknown as PostIdParam).id);
  res.status(StatusCodes.OK).json(result);
});

// 북마크
export const bookmarkPost = asyncHandler(async (req: Request, res: Response) => {
  const result = await bookmarkPostService(req.user!.id, (req.params as unknown as PostIdParam).id);
  res.status(StatusCodes.OK).json(result);
});

// 북마크 취소
export const unbookmarkPost = asyncHandler(async (req: Request, res: Response) => {
  const result = await unbookmarkPostService(req.user!.id, (req.params as unknown as PostIdParam).id);
  res.status(StatusCodes.OK).json(result);
});
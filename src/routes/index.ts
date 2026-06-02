import { type Router as RouterType, Router } from 'express';
import healthRouter from '@/modules/health/health.route';
import postsRouter  from '@/modules/posts/posts.route';
import characterRouter from '../modules/characters/character.route';
import followsRouter from '@/modules/follows/follows.route';
import authRouter from '../modules/auth/auth.route';
import closetRouter from '../modules/closet/closet.route';
import homeRouter from '@/modules/home/home.route';
import userRouter from '../modules/user/user.route';
import profileRouter from '../modules/profile/profile.route';

export const router: RouterType = Router();

router.use('/health', healthRouter);
router.use('/posts', postsRouter);
router.use('/characters', characterRouter);
router.use('/users', userRouter);
router.use('/users', followsRouter);
router.use('/auth', authRouter);
router.use('/closet', closetRouter);
router.use('/home', homeRouter);
router.use('/profile', profileRouter);
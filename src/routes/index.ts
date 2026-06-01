import { type Router as RouterType, Router } from 'express';
import healthRouter from '@/modules/health/health.route';
import postsRouter  from '@/modules/posts/posts.route';
import characterRouter from '../modules/characters/character.route';
import followsRouter from '@/modules/follows/follows.route';
import authRouter from '../modules/auth/auth.route';
import closetRouter from '../modules/closet/closet.route';
import fittingRouter from '../modules/fitting/fitting.route';
import homeRouter from '@/modules/home/home.route';

export const router: RouterType = Router();

router.use('/health', healthRouter);
router.use('/posts', postsRouter);
router.use('/characters', characterRouter);
router.use('/users', followsRouter);
router.use('/auth', authRouter);
router.use('/closet', closetRouter);
router.use('/fitting', fittingRouter);

router.use('/home', homeRouter);
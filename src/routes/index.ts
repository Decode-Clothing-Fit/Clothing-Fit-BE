import { type Router as RouterType, Router } from 'express';
import healthRouter from '../modules/health/health.route';
import characterRouter from '../modules/characters/character.route';
import followsRouter from '@/modules/follows/follows.route';

export const router: RouterType = Router();

router.use('/health', healthRouter);
router.use('/characters', characterRouter);
router.use('/users', followsRouter);
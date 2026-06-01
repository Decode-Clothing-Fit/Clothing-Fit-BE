import { type Router as RouterType, Router } from 'express';
import { authenticate } from '@/common/middleware/auth.middleware';
import { validate } from '@/common/middleware/validate.middleware';
import { getClosetDetailController, getClosetsController } from './closet.controller';
import { ClosetParamsSchema, ClosetQuerySchema } from './closet.schema';

const router: RouterType = Router();

router.get('/', authenticate, validate({ query: ClosetQuerySchema }), getClosetsController);
router.get('/:id', authenticate, validate({ params: ClosetParamsSchema }), getClosetDetailController);

export default router;

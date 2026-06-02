import { type Router as RouterType, Router } from 'express';
import { authenticate } from '@/common/middleware/auth.middleware';
import { validate } from '@/common/middleware/validate.middleware';
import { start3DFittingController, get3DFittingStatusController } from './fitting.controller';
import { Fitting3DRequestSchema, SessionIdParamSchema } from './fitting.schema';

const router: RouterType = Router();

router.post('/3d', authenticate, validate({ body: Fitting3DRequestSchema }), start3DFittingController);
router.get('/:sessionId', authenticate, validate({ params: SessionIdParamSchema }), get3DFittingStatusController);

export default router;

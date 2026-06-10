import { type Router as RouterType, Router } from 'express';
import { authenticate } from '@/common/middleware/auth.middleware';
import { validate } from '@/common/middleware/validate.middleware';
import { anyImageUpload } from '@/common/middleware/upload.middleware';
import {
    start3DFittingController,
    get3DFittingStatusController,
    updateFittingTitleController,
    updateFittingModelController,
    generateCoordiController
} from './fitting.controller';
import {
    Fitting3DRequestSchema,
    SessionIdParamSchema,
    FittingTitleParamSchema,
    FittingTitleBodySchema,
    MAX_COORDI_ITEMS,
} from './fitting.schema';

const router: RouterType = Router();

// 2d 코디 생성 api (의류 이미지 최대 5개, 필드명은 meta.items[].imageField로 지정)
// maxFileCount로 개수 상한을 강제해 초과 파일이 메모리에 적재되는 것을 막는다(DoS 방지).
router.post('/2d', authenticate, anyImageUpload({ maxFileCount: MAX_COORDI_ITEMS }), generateCoordiController);

// 3d 생성 api
router.post('/3d', authenticate, validate({ body: Fitting3DRequestSchema }), start3DFittingController);

// 피팅 결과 이름 변경
router.patch(
    '/:closetArchiveId/title',
    authenticate,
    validate({ params: FittingTitleParamSchema, body: FittingTitleBodySchema }),
    updateFittingTitleController,
);

// 3d 결과 저장
router.post('/3d/:sessionId/model', authenticate, validate({ params: SessionIdParamSchema }), updateFittingModelController);

// 3d 생성 폴링 api
router.get('/3d/:sessionId', authenticate, validate({ params: SessionIdParamSchema }), get3DFittingStatusController);

export default router;

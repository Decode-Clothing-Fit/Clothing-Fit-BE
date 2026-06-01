import { type Router as RouterType, Router } from 'express';
import multer from 'multer';
import { authenticate } from '@/common/middleware/auth.middleware';
import { generate2DFittingController } from './fitting.controller';

const router: RouterType = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  },
});

router.post(
  '/2d',
  authenticate,
  upload.fields([
    { name: 'topImage', maxCount: 1 },
    { name: 'bottomImage', maxCount: 1 },
    { name: 'footwearImage', maxCount: 1 },
  ]),
  generate2DFittingController,
);

export default router;

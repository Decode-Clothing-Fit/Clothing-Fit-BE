import { type Router as RouterType, Router } from 'express';
import { authenticate } from '@/common/middleware/auth.middleware';
import { validate } from '@/common/middleware/validate.middleware';
import { singleImageUpload } from '@/common/middleware/upload.middleware';
import {getUserAvatarController, updateUserAvatarController, updateUserAvatarImageController} from "./avatar.controller";
import { UserAvatarRequestSchema } from './avatar.schema';

const router: RouterType = Router();

// 사용자 아바타 조회
router.get('/', authenticate, getUserAvatarController);

// 사용자 아바타 변경 (캐릭터 선택)
router.patch('/', authenticate, validate({ body: UserAvatarRequestSchema }), updateUserAvatarController);

// 사용자 아바타 변경 (사진 업로드)
router.patch('/image', authenticate, singleImageUpload({ field: 'image' }), updateUserAvatarImageController);

export default router;
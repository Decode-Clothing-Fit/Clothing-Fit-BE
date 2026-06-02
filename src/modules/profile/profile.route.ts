import { type Router as RouterType, Router} from 'express'
import { authenticate } from '@/common/middleware/auth.middleware'
import { validate } from '@/common/middleware/validate.middleware'
import { getProfileController, checkNicknameController, updateNicknameController } from './profile.controller'
import { checkNicknameSchema, updateNicknameSchema } from './profile.schema'

const router: RouterType = Router();

// 내 프로필 조회
router.get('/', authenticate, getProfileController);

// 닉네임 중복 확인
router.get('/nickname/check', authenticate, validate({
    query: checkNicknameSchema
}), checkNicknameController);

//  낙네임 변경
router.patch('/nickname', authenticate, validate({
     body: updateNicknameSchema
}), updateNicknameController);

export default router;
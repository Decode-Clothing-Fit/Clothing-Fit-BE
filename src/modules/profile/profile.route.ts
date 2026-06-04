import { type Router as RouterType, Router} from 'express'
import { authenticate } from '@/common/middleware/auth.middleware'
import { validate } from '@/common/middleware/validate.middleware'
import { getProfileController, checkNicknameController, updateNicknameController,
    getBodyInfoController, updateBodyInfoController
 } from './profile.controller'
import { checkNicknameSchema, updateNicknameSchema, updateBodyInfoSchema } from './profile.schema'

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

// 체형 정보 조회
router.get('/body', authenticate, getBodyInfoController);

// 체형 정보 수정
router.patch('/body', authenticate, validate({
    body: updateBodyInfoSchema }), updateBodyInfoController);

export default router;
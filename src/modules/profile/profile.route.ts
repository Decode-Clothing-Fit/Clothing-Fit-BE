import { type Router as RouterType, Router} from 'express'
import { authenticate } from '@/common/middleware/auth.middleware'
import { validate } from '@/common/middleware/validate.middleware'
import { getProfileController, checkNicknameController, updateNicknameController,
    getBodyInfoController, updateBodyInfoController, getRecentPostsController, getBookmarkedPostsController, getLikedPostsController,
    updateProfileImageController
 } from './profile.controller'
import { checkNicknameSchema, updateNicknameSchema, updateBodyInfoSchema, profilePostsQuerySchema } from './profile.schema'
import multer from 'multer'

const router: RouterType = Router();
const upload = multer({ storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024} // 5MB
});

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

// 최근 조회한 커뮤니티 목록
router.get('/recent-posts', authenticate, validate({ query: profilePostsQuerySchema }), getRecentPostsController);

// 북마크한 코디 목록
router.get('/bookmarks', authenticate, validate({ query: profilePostsQuerySchema }), getBookmarkedPostsController);

// 좋아요한 게시글 목록
router.get('/interests', authenticate, validate({ query: profilePostsQuerySchema }), getLikedPostsController);

router.patch('/image', authenticate, upload.single('image'), updateProfileImageController)


export default router;
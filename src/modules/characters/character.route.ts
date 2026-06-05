import { type Router as RouterType, Router } from 'express';
import { getCharactersController } from './character.controller';

const router: RouterType = Router();

// 신체 타입 별 캐릭터 목록 조회 (선택 가능한 프리셋 카탈로그)
router.get('/', getCharactersController);

export default router;
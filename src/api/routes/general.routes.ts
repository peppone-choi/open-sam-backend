import { Router } from 'express';
import { GeneralController } from '../controllers/general.controller';
import { container } from 'tsyringe';

const router = Router();
const controller = container.resolve(GeneralController);

/**
 * GET /api/generals
 * 장수 목록 조회 (필터링, 페이지네이션)
 */
router.get('/', (req, res, next) => controller.getAll(req, res, next));

/**
 * GET /api/generals/:id
 * 특정 장수 조회
 */
router.get('/:id', (req, res, next) => controller.getById(req, res, next));

/**
 * POST /api/generals/:id/train
 * 장수 훈련 (능력치 증가)
 * Hint: 커맨드 발행, 실제 처리는 Game Daemon에서
 */
router.post('/:id/train', (req, res, next) => controller.train(req, res, next));

/**
 * POST /api/generals/:id/equip
 * 아이템 장착
 */
router.post('/:id/equip', (req, res, next) => controller.equip(req, res, next));

// TODO: 추가 엔드포인트 (이동, 특수능력 등)

export const generalRoutes = router;

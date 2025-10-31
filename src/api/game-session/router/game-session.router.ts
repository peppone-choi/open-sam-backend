import { Router } from 'express';
import { GameSessionController } from '../controller/game-session.controller';

/**
 * GameSession Router
 * 
 * Entity 시스템 기반 게임 세션 관리 API
 */
const router = Router();
const controller = new GameSessionController();

/**
 * GET /api/game-session
 * 전체 세션 조회 (페이지네이션)
 */
router.get('/', (req, res, next) => controller.getAll(req, res, next));

/**
 * POST /api/game-session
 * 세션 생성 (Entity 기반 초기화 포함)
 */
router.post('/', (req, res, next) => controller.create(req, res, next));

/**
 * GET /api/game-session/status/:status
 * 상태별 세션 조회
 */
router.get('/status/:status', (req, res, next) => controller.getByStatus(req, res, next));

/**
 * GET /api/game-session/scenario/:scenarioId
 * 시나리오 ID별 세션 조회
 */
router.get('/scenario/:scenarioId', (req, res, next) => controller.getByScenarioId(req, res, next));

/**
 * GET /api/game-session/:id
 * ID로 세션 조회
 */
router.get('/:id', (req, res, next) => controller.getById(req, res, next));

/**
 * PATCH /api/game-session/:id
 * 세션 업데이트
 */
router.patch('/:id', (req, res, next) => controller.update(req, res, next));

/**
 * DELETE /api/game-session/:id
 * 세션 삭제
 */
router.delete('/:id', (req, res, next) => controller.delete(req, res, next));

/**
 * POST /api/game-session/:id/update-stats
 * 세션 통계 업데이트 (Entity 기반 재계산)
 */
router.post('/:id/update-stats', (req, res, next) => controller.updateStats(req, res, next));

export default router;

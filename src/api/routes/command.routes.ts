import { Router } from 'express';
import { CommandController } from '../controllers/command.controller';
import { container } from 'tsyringe';

const router = Router();
const controller = container.resolve(CommandController);

/**
 * GET /api/commands
 * 커맨드 목록 조회 (특정 장수의 실행 중인 커맨드)
 */
router.get('/', (req, res, next) => controller.getByGeneral(req, res, next));

/**
 * POST /api/commands/:id/cancel
 * 커맨드 취소
 */
router.post('/:id/cancel', (req, res, next) => controller.cancel(req, res, next));

export const commandRoutes = router;

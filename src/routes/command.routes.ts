import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { CommandController } from '../controllers/command.controller';

const router = Router();

/**
 * @swagger
 * /api/command/get-reserved-command:
 *   get:
 *     summary: 예약된 커맨드 조회
 *     tags: [Command]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-reserved-command', authenticate, CommandController.getReservedCommand);

/**
 * @swagger
 * /api/command/push-command:
 *   post:
 *     summary: 커맨드 즉시 실행
 *     tags: [Command]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/push-command', authenticate, CommandController.pushCommand);

/**
 * @swagger
 * /api/command/repeat-command:
 *   post:
 *     summary: 커맨드 반복 설정
 *     tags: [Command]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/repeat-command', authenticate, CommandController.repeatCommand);

/**
 * @swagger
 * /api/command/reserve-bulk-command:
 *   post:
 *     summary: 다수 커맨드 일괄 예약
 *     tags: [Command]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/reserve-bulk-command', authenticate, CommandController.reserveBulkCommand);

/**
 * @swagger
 * /api/command/reserve-command:
 *   post:
 *     summary: 커맨드 예약
 *     tags: [Command]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/reserve-command', authenticate, CommandController.reserveCommand);

export default router;

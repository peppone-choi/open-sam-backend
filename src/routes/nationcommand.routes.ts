import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { GetReservedCommandService } from '../services/nationcommand/GetReservedCommand.service';
import { PushCommandService } from '../services/nationcommand/PushCommand.service';
import { RepeatCommandService } from '../services/nationcommand/RepeatCommand.service';
import { ReserveBulkCommandService } from '../services/nationcommand/ReserveBulkCommand.service';
import { ReserveCommandService } from '../services/nationcommand/ReserveCommand.service';

const router = Router();

/**
 * @swagger
 * /api/nationcommand/get-reserved-command:
 *   get:
 *     summary: 국가 예약 커맨드 조회
 *     tags: [NationCommand]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-reserved-command', authenticate, async (req, res) => {
  try {
    const result = await GetReservedCommandService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/nationcommand/push-command:
 *   post:
 *     summary: 국가 커맨드 즉시 실행
 *     tags: [NationCommand]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/push-command', authenticate, async (req, res) => {
  try {
    const result = await PushCommandService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/nationcommand/repeat-command:
 *   post:
 *     summary: 국가 커맨드 반복 설정
 *     tags: [NationCommand]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/repeat-command', authenticate, async (req, res) => {
  try {
    const result = await RepeatCommandService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/nationcommand/reserve-bulk-command:
 *   post:
 *     summary: 국가 커맨드 일괄 예약
 *     tags: [NationCommand]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/reserve-bulk-command', authenticate, async (req, res) => {
  try {
    const result = await ReserveBulkCommandService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/nationcommand/reserve-command:
 *   post:
 *     summary: 국가 커맨드 예약
 *     tags: [NationCommand]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/reserve-command', authenticate, async (req, res) => {
  try {
    const result = await ReserveCommandService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


export default router;

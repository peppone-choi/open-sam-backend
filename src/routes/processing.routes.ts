import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { GetProcessingCommandService } from '../services/processing/GetProcessingCommand.service';
import { SubmitProcessingCommandService } from '../services/processing/SubmitProcessingCommand.service';
import { recordCommandRequest } from '../common/metrics/command-metrics';
 
 const router = Router();

// Metrics middleware for processing commands
router.use((req, res, next) => {
  const start = process.hrtime.bigint();
  const sessionId = (req.query.session_id as string) || (req.body && (req.body as any).session_id);

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationSeconds = Number(end - start) / 1e9;

    recordCommandRequest({
      type: 'processing',
      method: req.method,
      status: res.statusCode,
      durationSeconds,
      sessionId,
    });
  });

  next();
});


/**
 * @swagger
 * /api/processing/command:
 *   post:
 *     summary: 명령 데이터 조회
 *     description: 현재 진행 중인 명령 데이터를 조회합니다.
 *     tags: [Processing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               session_id:
 *                 type: string
 *                 example: sangokushi_default
 *     responses:
 *       200:
 *         description: 명령 데이터 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                 command:
 *                   type: object
 */
router.post('/command', authenticate, async (req, res) => {
  try {
    const result = await GetProcessingCommandService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/processing/submit-command:
 *   post:
 *     summary: 명령 제출
 *     description: 새로운 명령을 제출하여 실행 대기열에 추가합니다.
 *     tags: [Processing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               session_id:
 *                 type: string
 *                 example: sangokushi_default
 *               commandID:
 *                 type: string
 *               params:
 *                 type: object
 *     responses:
 *       200:
 *         description: 명령 제출 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.post('/submit-command', authenticate, async (req, res) => {
  try {
    const result = await SubmitProcessingCommandService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;

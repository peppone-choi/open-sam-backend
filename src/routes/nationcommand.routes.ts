import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { recordCommandRequest } from '../common/metrics/command-metrics';
 
 import { GetReservedCommandService } from '../services/nationcommand/GetReservedCommand.service';

import { PushCommandService } from '../services/nationcommand/PushCommand.service';
import { RepeatCommandService } from '../services/nationcommand/RepeatCommand.service';
import { ReserveBulkCommandService } from '../services/nationcommand/ReserveBulkCommand.service';
import { ReserveCommandService } from '../services/nationcommand/ReserveCommand.service';

const router = Router();

// Metrics middleware for nation commands
router.use((req, res, next) => {
  const start = process.hrtime.bigint();
  const sessionId = (req.query.session_id as string) || (req.body && (req.body as any).session_id);

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationSeconds = Number(end - start) / 1e9;

    recordCommandRequest({
      type: 'nation',
      method: req.method,
      status: res.statusCode,
      durationSeconds,
      sessionId,
    });
  });

  next();
});
 
 
 // GetReservedCommand

/**
 * @swagger
 * /api/nationcommand/get-reserved-command:
 *   get:
 *     summary: NationCommand 조회
 *     description: |
 *       NationCommand 조회
 *       
 *       **주의사항:**
 *       - 인증이 필요한 경우 JWT 토큰을 헤더에 포함해야 합니다
 *       - 요청 본문은 JSON 형식이어야 합니다
 *     tags: [NationCommand]
 *     responses:
 *       200:
 *         description: 요청 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               success: true
 *               data: {}
 *       401:
 *         description: 인증 실패 - 유효하지 않거나 만료된 토큰
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid or expired token
 *       400:
 *         description: 잘못된 요청 - 필수 파라미터 누락 또는 유효하지 않은 값
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: 서버 내부 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.get('/get-reserved-command', authenticate, async (req, res) => {
  try {
    const result = await GetReservedCommandService.execute(req.query, req.user);
    res.json(result);
  } catch (error: any) {
    console.error('GetReservedCommand error:', error);
    res.status(500).json({ result: false, reason: error.message || 'NationCommand 조회 중 서버 오류가 발생했습니다' });
  }
});


// PushCommand
/**
 * @swagger
 * /api/nationcommand/push-command:
 *   post:
 *     summary: NationCommand 생성
 *     description: |
 *       NationCommand 생성
 *       
 *       **주의사항:**
 *       - 인증이 필요한 경우 JWT 토큰을 헤더에 포함해야 합니다
 *       - 요청 본문은 JSON 형식이어야 합니다
 *     tags: [NationCommand]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *           example:
 *             # 요청 예제를 여기에 추가하세요
 *     responses:
 *       200:
 *         description: 요청 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               success: true
 *               data: {}
 *       401:
 *         description: 인증 실패 - 유효하지 않거나 만료된 토큰
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid or expired token
 *       400:
 *         description: 잘못된 요청 - 필수 파라미터 누락 또는 유효하지 않은 값
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: 서버 내부 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.post('/push-command', authenticate, async (req, res) => {
  try {
    const result = await PushCommandService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    console.error('PushCommand error:', error);
    res.status(500).json({ result: false, reason: error.message || 'NationCommand 생성 중 서버 오류가 발생했습니다' });
  }
});


// RepeatCommand
/**
 * @swagger
 * /api/nationcommand/repeat-command:
 *   post:
 *     summary: NationCommand 생성
 *     description: |
 *       NationCommand 생성
 *       
 *       **주의사항:**
 *       - 인증이 필요한 경우 JWT 토큰을 헤더에 포함해야 합니다
 *       - 요청 본문은 JSON 형식이어야 합니다
 *     tags: [NationCommand]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *           example:
 *             # 요청 예제를 여기에 추가하세요
 *     responses:
 *       200:
 *         description: 요청 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               success: true
 *               data: {}
 *       401:
 *         description: 인증 실패 - 유효하지 않거나 만료된 토큰
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid or expired token
 *       400:
 *         description: 잘못된 요청 - 필수 파라미터 누락 또는 유효하지 않은 값
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: 서버 내부 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.post('/repeat-command', authenticate, async (req, res) => {
  try {
    const result = await RepeatCommandService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    console.error('RepeatCommand error:', error);
    res.status(500).json({ result: false, reason: error.message || 'NationCommand 생성 중 서버 오류가 발생했습니다' });
  }
});


// ReserveBulkCommand
/**
 * @swagger
 * /api/nationcommand/reserve-bulk-command:
 *   post:
 *     summary: NationCommand 생성
 *     description: |
 *       NationCommand 생성
 *       
 *       **주의사항:**
 *       - 인증이 필요한 경우 JWT 토큰을 헤더에 포함해야 합니다
 *       - 요청 본문은 JSON 형식이어야 합니다
 *     tags: [NationCommand]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *           example:
 *             # 요청 예제를 여기에 추가하세요
 *     responses:
 *       200:
 *         description: 요청 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               success: true
 *               data: {}
 *       401:
 *         description: 인증 실패 - 유효하지 않거나 만료된 토큰
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid or expired token
 *       400:
 *         description: 잘못된 요청 - 필수 파라미터 누락 또는 유효하지 않은 값
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: 서버 내부 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.post('/reserve-bulk-command', authenticate, async (req, res) => {
  try {
    const result = await ReserveBulkCommandService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    console.error('ReserveBulkCommand error:', error);
    res.status(500).json({ result: false, reason: error.message || 'NationCommand 생성 중 서버 오류가 발생했습니다' });
  }
});


// ReserveCommand
/**
 * @swagger
 * /api/nationcommand/reserve-command:
 *   post:
 *     summary: NationCommand 생성
 *     description: |
 *       NationCommand 생성
 *       
 *       **주의사항:**
 *       - 인증이 필요한 경우 JWT 토큰을 헤더에 포함해야 합니다
 *       - 요청 본문은 JSON 형식이어야 합니다
 *     tags: [NationCommand]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *           example:
 *             # 요청 예제를 여기에 추가하세요
 *     responses:
 *       200:
 *         description: 요청 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               success: true
 *               data: {}
 *       401:
 *         description: 인증 실패 - 유효하지 않거나 만료된 토큰
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid or expired token
 *       400:
 *         description: 잘못된 요청 - 필수 파라미터 누락 또는 유효하지 않은 값
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: 서버 내부 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.post('/reserve-command', authenticate, async (req, res) => {
  try {
    const result = await ReserveCommandService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    console.error('ReserveCommand error:', error);
    res.status(500).json({ result: false, reason: error.message || 'NationCommand 생성 중 서버 오류가 발생했습니다' });
  }
});


export default router;

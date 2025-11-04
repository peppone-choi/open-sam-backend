import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { GetNPCControlService } from '../services/npc/GetNPCControl.service';
import { SetNPCControlService } from '../services/npc/SetNPCControl.service';

const router = Router();

/**
 * @swagger
 * /api/npc/get-control:
 *   post:
 *     summary: NPC 제어 정보 조회
 *     description: NPC의 현재 제어 상태와 설정을 조회합니다.
 *     tags: [NPC]
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
 *               npcID:
 *                 type: number
 *     responses:
 *       200:
 *         description: NPC 제어 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                 control:
 *                   type: object
 */
router.post('/get-control', authenticate, async (req, res) => {
  try {
    const result = await GetNPCControlService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/npc/set-control:
 *   post:
 *     summary: NPC 제어 설정
 *     description: NPC의 행동 패턴과 전략을 설정합니다.
 *     tags: [NPC]
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
 *               npcID:
 *                 type: number
 *               control:
 *                 type: object
 *     responses:
 *       200:
 *         description: NPC 제어 설정 성공
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
router.post('/set-control', authenticate, async (req, res) => {
  try {
    const result = await SetNPCControlService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;

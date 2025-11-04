import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { GetWorldInfoService } from '../services/world/GetWorldInfo.service';

const router = Router();

/**
 * @swagger
 * /api/world/info:
 *   post:
 *     summary: 세계 정보 조회
 *     description: 게임 세계의 전반적인 정보를 조회합니다.
 *     tags: [World]
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
 *         description: 세계 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                 world:
 *                   type: object
 */
router.post('/info', authenticate, async (req, res) => {
  try {
    const result = await GetWorldInfoService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;

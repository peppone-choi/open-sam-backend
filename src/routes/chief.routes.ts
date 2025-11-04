import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { GetChiefCenterService } from '../services/chief/GetChiefCenter.service';

const router = Router();

/**
 * @swagger
 * /api/chief/center:
 *   post:
 *     summary: 제왕 센터
 *     description: 제왕(군주)의 특수 기능 및 정보를 조회합니다.
 *     tags: [Chief]
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
 *         description: 제왕 센터 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                 center:
 *                   type: object
 */
router.post('/center', authenticate, async (req, res) => {
  try {
    const result = await GetChiefCenterService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;

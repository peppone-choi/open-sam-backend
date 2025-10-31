import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { BetService } from '../services/betting/Bet.service';
import { GetBettingDetailService } from '../services/betting/GetBettingDetail.service';
import { GetBettingListService } from '../services/betting/GetBettingList.service';

const router = Router();

/**
 * @swagger
 * /api/betting/bet:
 *   post:
 *     summary: 베팅하기
 *     tags: [Betting]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/bet', authenticate, async (req, res) => {
  try {
    const result = await BetService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/betting/get-betting-detail:
 *   get:
 *     summary: 베팅 상세 조회
 *     tags: [Betting]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-betting-detail', authenticate, async (req, res) => {
  try {
    const result = await GetBettingDetailService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/betting/get-betting-list:
 *   get:
 *     summary: 베팅 목록 조회
 *     tags: [Betting]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-betting-list', authenticate, async (req, res) => {
  try {
    const result = await GetBettingListService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


export default router;

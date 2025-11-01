import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { BuyHiddenBuffService } from '../services/inheritaction/BuyHiddenBuff.service';
import { BuyRandomUniqueService } from '../services/inheritaction/BuyRandomUnique.service';
import { CheckOwnerService } from '../services/inheritaction/CheckOwner.service';
import { GetMoreLogService } from '../services/inheritaction/GetMoreLog.service';
import { ResetSpecialWarService } from '../services/inheritaction/ResetSpecialWar.service';
import { ResetStatService } from '../services/inheritaction/ResetStat.service';
import { ResetTurnTimeService } from '../services/inheritaction/ResetTurnTime.service';
import { SetNextSpecialWarService } from '../services/inheritaction/SetNextSpecialWar.service';

const router = Router();

/**
 * @swagger
 * /api/inheritaction/buy-hidden-buff:
 *   post:
 *     summary: 숨겨진 버프 구매
 *     tags: [Inheritaction]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/buy-hidden-buff', authenticate, async (req, res) => {
  try {
    const result = await BuyHiddenBuffService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/inheritaction/buy-random-unique:
 *   post:
 *     summary: 랜덤 명품 구매
 *     tags: [Inheritaction]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/buy-random-unique', authenticate, async (req, res) => {
  try {
    const result = await BuyRandomUniqueService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/inheritaction/check-owner:
 *   post:
 *     summary: 소유자 확인
 *     tags: [Inheritaction]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/check-owner', authenticate, async (req, res) => {
  try {
    const result = await CheckOwnerService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/inheritaction/get-more-log:
 *   get:
 *     summary: 추가 로그 조회
 *     tags: [Inheritaction]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-more-log', authenticate, async (req, res) => {
  try {
    const result = await GetMoreLogService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/inheritaction/reset-special-war:
 *   post:
 *     summary: 특수 전쟁 리셋
 *     tags: [Inheritaction]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/reset-special-war', authenticate, async (req, res) => {
  try {
    const result = await ResetSpecialWarService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/inheritaction/reset-stat:
 *   post:
 *     summary: 스탯 리셋
 *     tags: [Inheritaction]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/reset-stat', authenticate, async (req, res) => {
  try {
    const result = await ResetStatService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/inheritaction/reset-turn-time:
 *   post:
 *     summary: 턴 시간 리셋
 *     tags: [Inheritaction]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/reset-turn-time', authenticate, async (req, res) => {
  try {
    const result = await ResetTurnTimeService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/inheritaction/set-next-special-war:
 *   post:
 *     summary: 다음 특수 전쟁 설정
 *     tags: [Inheritaction]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/set-next-special-war', authenticate, async (req, res) => {
  try {
    const result = await SetNextSpecialWarService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


export default router;

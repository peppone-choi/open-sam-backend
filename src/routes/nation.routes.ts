import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { GeneralListService } from '../services/nation/GeneralList.service';
import { GetGeneralLogService } from '../services/nation/GetGeneralLog.service';
import { GetNationInfoService } from '../services/nation/GetNationInfo.service';
import { SetBillService } from '../services/nation/SetBill.service';
import { SetBlockScoutService } from '../services/nation/SetBlockScout.service';
import { SetBlockWarService } from '../services/nation/SetBlockWar.service';
import { SetNoticeService } from '../services/nation/SetNotice.service';
import { SetRateService } from '../services/nation/SetRate.service';
import { SetScoutMsgService } from '../services/nation/SetScoutMsg.service';
import { SetSecretLimitService } from '../services/nation/SetSecretLimit.service';
import { SetTroopNameService } from '../services/nation/SetTroopName.service';

const router = Router();

/**
 * @swagger
 * /api/nation/general-list:
 *   post:
 *     summary: 국가 소속 장수 목록
 *     tags: [Nation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/general-list', authenticate, async (req, res) => {
  try {
    const result = await GeneralListService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/nation/get-general-log:
 *   get:
 *     summary: 장수 로그 조회
 *     tags: [Nation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-general-log', authenticate, async (req, res) => {
  try {
    const result = await GetGeneralLogService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/nation/get-nation-info:
 *   get:
 *     summary: 국가 정보 조회
 *     tags: [Nation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-nation-info', authenticate, async (req, res) => {
  try {
    const result = await GetNationInfoService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/nation/set-bill:
 *   post:
 *     summary: 국가 법안 설정
 *     tags: [Nation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/set-bill', authenticate, async (req, res) => {
  try {
    const result = await SetBillService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/nation/set-block-scout:
 *   post:
 *     summary: 정찰 차단 설정
 *     tags: [Nation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/set-block-scout', authenticate, async (req, res) => {
  try {
    const result = await SetBlockScoutService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/nation/set-block-war:
 *   post:
 *     summary: 전쟁 차단 설정
 *     tags: [Nation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/set-block-war', authenticate, async (req, res) => {
  try {
    const result = await SetBlockWarService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/nation/set-notice:
 *   post:
 *     summary: 국가 공지 설정
 *     tags: [Nation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/set-notice', authenticate, async (req, res) => {
  try {
    const result = await SetNoticeService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/nation/set-rate:
 *   post:
 *     summary: 세율 설정
 *     tags: [Nation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/set-rate', authenticate, async (req, res) => {
  try {
    const result = await SetRateService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/nation/set-scout-msg:
 *   post:
 *     summary: 정찰 메시지 설정
 *     tags: [Nation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/set-scout-msg', authenticate, async (req, res) => {
  try {
    const result = await SetScoutMsgService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/nation/set-secret-limit:
 *   post:
 *     summary: 비밀 제한 설정
 *     tags: [Nation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/set-secret-limit', authenticate, async (req, res) => {
  try {
    const result = await SetSecretLimitService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/nation/set-troop-name:
 *   post:
 *     summary: 부대 이름 설정
 *     tags: [Nation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/set-troop-name', authenticate, async (req, res) => {
  try {
    const result = await SetTroopNameService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


export default router;

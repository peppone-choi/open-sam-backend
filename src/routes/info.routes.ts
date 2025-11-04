import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { GetGeneralInfoService } from '../services/info/GetGeneralInfo.service';
import { GetBettingListService } from '../services/betting/GetBettingList.service';
import { GetOfficerInfoService } from '../services/info/GetOfficerInfo.service';
import { GetTournamentInfoService } from '../services/info/GetTournamentInfo.service';

const router = Router();

/**
 * @swagger
 * /api/info/general:
 *   post:
 *     summary: 장수 정보 조회
 *     description: 특정 장수 또는 현재 유저의 정보를 조회합니다.
 *     tags: [Info]
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
 *               generalID:
 *                 type: number
 *                 description: 조회할 장수 ID (없으면 현재 유저)
 *     responses:
 *       200:
 *         description: 장수 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                 general:
 *                   type: object
 */
router.post('/general', authenticate, async (req, res) => {
  try {
    const result = await GetGeneralInfoService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/info/officer:
 *   post:
 *     summary: 관직자 정보 조회
 *     description: 국가의 관직자들 정보를 조회합니다.
 *     tags: [Info]
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
 *         description: 관직자 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                 officer:
 *                   type: object
 */
router.post('/officer', authenticate, async (req, res) => {
  try {
    const result = await GetOfficerInfoService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/info/tournament:
 *   post:
 *     summary: 토너먼트 정보 조회
 *     description: 현재 진행 중인 토너먼트 정보를 조회합니다.
 *     tags: [Info]
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
 *         description: 토너먼트 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                 tournament:
 *                   type: object
 */
router.post('/tournament', authenticate, async (req, res) => {
  try {
    const result = await GetTournamentInfoService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/info/betting:
 *   post:
 *     summary: 배팅 정보 조회
 *     description: 현재 진행 중인 배팅 목록을 조회합니다.
 *     tags: [Info]
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
 *         description: 배팅 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                 bettingList:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.post('/betting', authenticate, async (req, res) => {
  try {
    // GetBettingListService 재사용
    const result = await GetBettingListService.execute(req.body, req.user);
    if (result.result) {
      res.json({
        result: true,
        bettingList: result.bettingList || []
      });
    } else {
      res.json({
        result: false,
        bettingList: [],
        reason: result.reason
      });
    }
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;

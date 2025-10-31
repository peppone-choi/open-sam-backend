import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { ExecuteEngineService } from '../services/global/ExecuteEngine.service';
import { GeneralListService } from '../services/global/GeneralList.service';
import { GeneralListWithTokenService } from '../services/global/GeneralListWithToken.service';
import { GetCachedMapService } from '../services/global/GetCachedMap.service';
import { GetConstService } from '../services/global/GetConst.service';
import { GetCurrentHistoryService } from '../services/global/GetCurrentHistory.service';
import { GetDiplomacyService } from '../services/global/GetDiplomacy.service';
import { GetGlobalMenuService } from '../services/global/GetGlobalMenu.service';
import { GetHistoryService } from '../services/global/GetHistory.service';
import { GetMapService } from '../services/global/GetMap.service';
import { GetNationListService } from '../services/global/GetNationList.service';
import { GetRecentRecordService } from '../services/global/GetRecentRecord.service';

const router = Router();

/**
 * @swagger
 * /api/global/execute-engine:
 *   post:
 *     summary: 게임 엔진 실행
 *     tags: [Global]
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/execute-engine', async (req, res) => {
  try {
    const result = await ExecuteEngineService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/global/general-list:
 *   post:
 *     summary: 장수 목록 조회
 *     tags: [Global]
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/general-list', async (req, res) => {
  try {
    const result = await GeneralListService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/global/general-list-with-token:
 *   post:
 *     summary: 토큰 포함 장수 목록 조회
 *     tags: [Global]
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/general-list-with-token', async (req, res) => {
  try {
    const result = await GeneralListWithTokenService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/global/get-cached-map:
 *   get:
 *     summary: 캐시된 맵 정보 조회
 *     tags: [Global]
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-cached-map', async (req, res) => {
  try {
    const result = await GetCachedMapService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/global/get-const:
 *   get:
 *     summary: 게임 상수 조회
 *     tags: [Global]
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-const', async (req, res) => {
  try {
    const result = await GetConstService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/global/get-current-history:
 *   get:
 *     summary: 현재 히스토리 조회
 *     tags: [Global]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-current-history', authenticate, async (req, res) => {
  try {
    const result = await GetCurrentHistoryService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/global/get-diplomacy:
 *   get:
 *     summary: 외교 정보 조회
 *     tags: [Global]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-diplomacy', authenticate, async (req, res) => {
  try {
    const result = await GetDiplomacyService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/global/get-global-menu:
 *   get:
 *     summary: 글로벌 메뉴 조회
 *     tags: [Global]
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-global-menu', async (req, res) => {
  try {
    const result = await GetGlobalMenuService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/global/get-history:
 *   get:
 *     summary: 히스토리 조회
 *     tags: [Global]
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-history', async (req, res) => {
  try {
    const result = await GetHistoryService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/global/get-map:
 *   get:
 *     summary: 맵 정보 조회
 *     tags: [Global]
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-map', async (req, res) => {
  try {
    const result = await GetMapService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/global/get-nation-list:
 *   get:
 *     summary: 국가 목록 조회
 *     tags: [Global]
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-nation-list', async (req, res) => {
  try {
    const result = await GetNationListService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/global/get-recent-record:
 *   get:
 *     summary: 최근 기록 조회
 *     tags: [Global]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-recent-record', authenticate, async (req, res) => {
  try {
    const result = await GetRecentRecordService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


export default router;

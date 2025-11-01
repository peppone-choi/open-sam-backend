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


// ExecuteEngine
/**
 * @swagger
 * /api/global/execute-engine:
 *   post:
 *     summary: Global 생성
 *     description: |
 *       Global 생성
 *       
 *       **주의사항:**
 *       - 인증이 필요한 경우 JWT 토큰을 헤더에 포함해야 합니다
 *       - 요청 본문은 JSON 형식이어야 합니다
 *     tags: [Global]
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
router.post('/execute-engine', async (req, res) => {
  try {
    const result = await ExecuteEngineService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GeneralList
/**
 * @swagger
 * /api/global/general-list:
 *   post:
 *     summary: Global 생성
 *     description: |
 *       Global 생성
 *       
 *       **주의사항:**
 *       - 인증이 필요한 경우 JWT 토큰을 헤더에 포함해야 합니다
 *       - 요청 본문은 JSON 형식이어야 합니다
 *     tags: [Global]
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
router.post('/general-list', async (req, res) => {
  try {
    const result = await GeneralListService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GeneralListWithToken
/**
 * @swagger
 * /api/global/general-list-with-token:
 *   post:
 *     summary: Global 생성
 *     description: |
 *       Global 생성
 *       
 *       **주의사항:**
 *       - 인증이 필요한 경우 JWT 토큰을 헤더에 포함해야 합니다
 *       - 요청 본문은 JSON 형식이어야 합니다
 *     tags: [Global]
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
router.post('/general-list-with-token', async (req, res) => {
  try {
    const result = await GeneralListWithTokenService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetCachedMap
/**
 * @swagger
 * /api/global/get-cached-map:
 *   get:
 *     summary: Global 조회
 *     description: |
 *       Global 조회
 *       
 *       **주의사항:**
 *       - 인증이 필요한 경우 JWT 토큰을 헤더에 포함해야 합니다
 *       - 요청 본문은 JSON 형식이어야 합니다
 *     tags: [Global]
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
router.get('/get-cached-map', async (req, res) => {
  try {
    const result = await GetCachedMapService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetConst
/**
 * @swagger
 * /api/global/get-const:
 *   get:
 *     summary: Global 조회
 *     description: |
 *       Global 조회
 *       
 *       **주의사항:**
 *       - 인증이 필요한 경우 JWT 토큰을 헤더에 포함해야 합니다
 *       - 요청 본문은 JSON 형식이어야 합니다
 *     tags: [Global]
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
router.get('/get-const', async (req, res) => {
  try {
    const result = await GetConstService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetCurrentHistory
/**
 * @swagger
 * /api/global/get-current-history:
 *   get:
 *     summary: Global 조회
 *     description: |
 *       Global 조회
 *       
 *       **주의사항:**
 *       - 인증이 필요한 경우 JWT 토큰을 헤더에 포함해야 합니다
 *       - 요청 본문은 JSON 형식이어야 합니다
 *     tags: [Global]
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
router.get('/get-current-history', authenticate, async (req, res) => {
  try {
    const result = await GetCurrentHistoryService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetDiplomacy
/**
 * @swagger
 * /api/global/get-diplomacy:
 *   get:
 *     summary: Global 조회
 *     description: |
 *       Global 조회
 *       
 *       **주의사항:**
 *       - 인증이 필요한 경우 JWT 토큰을 헤더에 포함해야 합니다
 *       - 요청 본문은 JSON 형식이어야 합니다
 *     tags: [Global]
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
router.get('/get-diplomacy', authenticate, async (req, res) => {
  try {
    const result = await GetDiplomacyService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetGlobalMenu
/**
 * @swagger
 * /api/global/get-global-menu:
 *   get:
 *     summary: Global 조회
 *     description: |
 *       Global 조회
 *       
 *       **주의사항:**
 *       - 인증이 필요한 경우 JWT 토큰을 헤더에 포함해야 합니다
 *       - 요청 본문은 JSON 형식이어야 합니다
 *     tags: [Global]
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
router.get('/get-global-menu', async (req, res) => {
  try {
    const result = await GetGlobalMenuService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetHistory
/**
 * @swagger
 * /api/global/get-history:
 *   get:
 *     summary: Global 조회
 *     description: |
 *       Global 조회
 *       
 *       **주의사항:**
 *       - 인증이 필요한 경우 JWT 토큰을 헤더에 포함해야 합니다
 *       - 요청 본문은 JSON 형식이어야 합니다
 *     tags: [Global]
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
router.get('/get-history', async (req, res) => {
  try {
    const result = await GetHistoryService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetMap
/**
 * @swagger
 * /api/global/get-map:
 *   get:
 *     summary: Global 조회
 *     description: |
 *       Global 조회
 *       
 *       **주의사항:**
 *       - 인증이 필요한 경우 JWT 토큰을 헤더에 포함해야 합니다
 *       - 요청 본문은 JSON 형식이어야 합니다
 *     tags: [Global]
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
router.get('/get-map', async (req, res) => {
  try {
    const result = await GetMapService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetNationList
/**
 * @swagger
 * /api/global/get-nation-list:
 *   get:
 *     summary: Global 조회
 *     description: |
 *       Global 조회
 *       
 *       **주의사항:**
 *       - 인증이 필요한 경우 JWT 토큰을 헤더에 포함해야 합니다
 *       - 요청 본문은 JSON 형식이어야 합니다
 *     tags: [Global]
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
router.get('/get-nation-list', async (req, res) => {
  try {
    const result = await GetNationListService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetRecentRecord
/**
 * @swagger
 * /api/global/get-recent-record:
 *   get:
 *     summary: Global 조회
 *     description: |
 *       Global 조회
 *       
 *       **주의사항:**
 *       - 인증이 필요한 경우 JWT 토큰을 헤더에 포함해야 합니다
 *       - 요청 본문은 JSON 형식이어야 합니다
 *     tags: [Global]
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
router.get('/get-recent-record', authenticate, async (req, res) => {
  try {
    const result = await GetRecentRecordService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


export default router;

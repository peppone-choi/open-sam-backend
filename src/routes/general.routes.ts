import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { BuildNationCandidateService } from '../services/general/BuildNationCandidate.service';
import { DieOnPrestartService } from '../services/general/DieOnPrestart.service';
import { DropItemService } from '../services/general/DropItem.service';
import { GetCommandTableService } from '../services/general/GetCommandTable.service';
import { GetFrontInfoService } from '../services/general/GetFrontInfo.service';
import { GetGeneralLogService } from '../services/general/GetGeneralLog.service';
import { InstantRetreatService } from '../services/general/InstantRetreat.service';
import { JoinService } from '../services/general/Join.service';

const router = Router();

/**
 * @swagger
 * /api/general/build-nation-candidate:
 *   post:
 *     summary: 건국 후보 등록
 *     tags: [General]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/build-nation-candidate', authenticate, async (req, res) => {
  try {
    const result = await BuildNationCandidateService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/general/die-on-prestart:
 *   post:
 *     summary: 사전 시작 시 사망 처리
 *     tags: [General]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/die-on-prestart', authenticate, async (req, res) => {
  try {
    const result = await DieOnPrestartService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/general/drop-item:
 *   post:
 *     summary: 아이템 버리기
 *     tags: [General]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/drop-item', authenticate, async (req, res) => {
  try {
    const result = await DropItemService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/general/get-command-table:
 *   get:
 *     summary: 커맨드 테이블 조회
 *     tags: [General]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-command-table', authenticate, async (req, res) => {
  try {
    const result = await GetCommandTableService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/general/get-front-info:
 *   get:
 *     summary: 전선 정보 조회
 *     tags: [General]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-front-info', authenticate, async (req, res) => {
  try {
    const result = await GetFrontInfoService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/general/get-general-log:
 *   get:
 *     summary: 장수 로그 조회
 *     tags: [General]
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-general-log', async (req, res) => {
  try {
    const result = await GetGeneralLogService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/general/instant-retreat:
 *   post:
 *     summary: 즉시 후퇴
 *     tags: [General]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/instant-retreat', authenticate, async (req, res) => {
  try {
    const result = await InstantRetreatService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/general/join:
 *   post:
 *     summary: 게임 참여
 *     tags: [General]
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/join', async (req, res) => {
  try {
    const result = await JoinService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


export default router;

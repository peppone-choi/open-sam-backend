/**
 * Archive API 라우트
 * 명예의 전당, 기록 등 아카이브 관련 API
 */

import { Router } from 'express';
import { ArchiveService } from '../services/archive.service';

const router = Router();

/**
 * @swagger
 * /api/archive/hall-of-fame:
 *   post:
 *     summary: 명예의 전당 조회
 *     description: 시즌/시나리오별 명예의 전당 데이터를 조회합니다.
 *     tags: [Archive]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               seasonIdx:
 *                 type: number
 *               scenarioIdx:
 *                 type: number
 */
router.post('/hall-of-fame', async (req, res) => {
  try {
    const { seasonIdx, scenarioIdx } = req.body;
    
    const result = await ArchiveService.getHallOfFame(seasonIdx, scenarioIdx);
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/archive/emperor:
 *   post:
 *     summary: 황제 목록 조회
 *     description: 게임 종료 후 황제가 된 국가 목록을 조회합니다.
 *     tags: [Archive]
 */
router.post('/emperor', async (req, res) => {
  try {
    const result = await ArchiveService.getEmperorList();
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/archive/emperior:
 *   post:
 *     summary: 황제 목록 조회 (별칭)
 *     tags: [Archive]
 */
router.post('/emperior', async (req, res) => {
  try {
    const result = await ArchiveService.getEmperorList();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/archive/emperor-detail:
 *   post:
 *     summary: 황제 상세 정보 조회
 *     tags: [Archive]
 */
router.post('/emperor-detail', async (req, res) => {
  try {
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json({
        result: false,
        reason: 'id가 필요합니다'
      });
    }

    const result = await ArchiveService.getEmperorDetail(id);
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/archive/emperior-detail:
 *   post:
 *     summary: 황제 상세 정보 조회 (별칭)
 *     tags: [Archive]
 */
router.post('/emperior-detail', async (req, res) => {
  try {
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json({
        result: false,
        reason: 'id가 필요합니다'
      });
    }

    const result = await ArchiveService.getEmperorDetail(id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/archive/generals:
 *   post:
 *     summary: 장수 기록 조회
 *     tags: [Archive]
 */
router.post('/generals', async (req, res) => {
  try {
    const { sessionId, limit = 100 } = req.body;
    
    const result = await ArchiveService.getGeneralRecords(sessionId, limit);
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/archive/nations:
 *   post:
 *     summary: 국가 기록 조회
 *     tags: [Archive]
 */
router.post('/nations', async (req, res) => {
  try {
    const { sessionId, limit = 100 } = req.body;
    
    const result = await ArchiveService.getNationRecords(sessionId, limit);
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/archive/best-general:
 *   post:
 *     summary: 최고 장수 조회
 *     tags: [Archive]
 */
router.post('/best-general', async (req, res) => {
  try {
    const { sessionId, type = 'experience', btn } = req.body;
    const defaultSessionId = sessionId || 'sangokushi_default';
    
    const result = await ArchiveService.getBestGeneralList(defaultSessionId, type, btn);
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/archive/gen-list:
 *   post:
 *     summary: 장수 목록 조회
 *     tags: [Archive]
 */
router.post('/gen-list', async (req, res) => {
  try {
    const { sessionId, type } = req.body;
    const defaultSessionId = sessionId || 'sangokushi_default';
    
    const result = await ArchiveService.getGenList(defaultSessionId, type);
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/archive/kingdom-list:
 *   post:
 *     summary: 왕국 목록 조회
 *     tags: [Archive]
 */
router.post('/kingdom-list', async (req, res) => {
  try {
    const result = await ArchiveService.getKingdomList();
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/archive/npc-list:
 *   post:
 *     summary: NPC 목록 조회
 *     tags: [Archive]
 */
router.post('/npc-list', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const defaultSessionId = sessionId || 'sangokushi_default';
    
    const result = await ArchiveService.getNPCList(defaultSessionId);
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/archive/traffic:
 *   post:
 *     summary: 교통 정보 조회
 *     tags: [Archive]
 */
router.post('/traffic', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const defaultSessionId = sessionId || 'sangokushi_default';
    
    const result = await ArchiveService.getTraffic(defaultSessionId);
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

export default router;


// @ts-nocheck - Type issues need investigation
import { Router, Request, Response, NextFunction } from 'express';
import { GetNationListService } from '../services/global/GetNationList.service';
import { GetMapService } from '../services/global/GetMap.service';
import { GetGlobalMenuService } from '../services/global/GetGlobalMenu.service';
import { Session } from '../models/session.model';

const router = Router();

/**
 * @swagger
 * /api/global/get-map:
 *   get:
 *     summary: 맵 정보 조회
 *     tags: [Global]
 *     parameters:
 *       - in: query
 *         name: serverID
 *         schema:
 *           type: string
 *         description: 서버 ID
 *       - in: query
 *         name: neutralView
 *         schema:
 *           type: integer
 *           enum: [0, 1]
 *         description: 중립 시점 여부
 *       - in: query
 *         name: showMe
 *         schema:
 *           type: integer
 *           enum: [0, 1]
 *         description: 내 위치 표시 여부
 *     responses:
 *       200:
 *         description: 맵 정보
 */
router.get('/get-map', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const serverID = req.query.serverID as string;
    const sessionId = serverID || req.query.session_id as string || 'sangokushi_default';
    const neutralView = req.query.neutralView === '1' || false;
    const showMe = req.query.showMe === '1' || false;
    
    const result = await GetMapService.execute({
      session_id: sessionId,
      neutralView,
      showMe
    }, req.user);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/global/get-global-menu:
 *   get:
 *     summary: 글로벌 메뉴 조회
 *     tags: [Global]
 *     parameters:
 *       - in: query
 *         name: serverID
 *         schema:
 *           type: string
 *       - in: query
 *         name: session_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 메뉴 정보
 */
router.get('/get-global-menu', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const serverID = req.query.serverID as string;
    const sessionId = serverID || req.query.session_id as string || 'sangokushi_default';
    
    const result = await GetGlobalMenuService.execute({
      session_id: sessionId
    }, req.user);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/global/get-const:
 *   get:
 *     summary: 글로벌 상수 조회
 *     tags: [Global]
 *     responses:
 *       200:
 *         description: 상수 정보
 */
router.get('/get-const', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { default: GameConstants } = await import('../utils/game-constants');
    
    // 게임 상수 반환
    const constants = {
      MAX_TURN: GameConstants.MAX_TURN || 30,
      MAX_GENERAL: GameConstants.MAX_GENERAL || 500,
      MAX_NATION: GameConstants.MAX_NATION || 55,
      DEFAULT_STAT_MIN: GameConstants.DEFAULT_STAT_MIN || 30,
      DEFAULT_STAT_MAX: GameConstants.DEFAULT_STAT_MAX || 100,
      DEFAULT_STAT_TOTAL: GameConstants.DEFAULT_STAT_TOTAL || 200,
      DEFAULT_START_YEAR: GameConstants.DEFAULT_START_YEAR || 180,
      DEFAULT_GOLD: GameConstants.DEFAULT_GOLD || 1000,
      DEFAULT_RICE: GameConstants.DEFAULT_RICE || 1000,
      MAX_LEVEL: GameConstants.MAX_LEVEL || 255
    };
    
    res.json({
      result: true,
      data: constants,
    });
  } catch (error) {
    next(error);
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
 *         description: 국가 목록
 */
router.get('/get-nation-list', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = (req.query.session_id || req.query.serverID || 'sangokushi_default') as string;
    const result = await GetNationListService.execute({ session_id: sessionId }, req.user);
    if (result.success && result.nations) {
      res.json({
        result: true,
        nationList: result.nations
      });
    } else {
      res.json({
        result: false,
        nationList: {},
        reason: result.message || '국가 목록을 조회할 수 없습니다'
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/global/general-list:
 *   post:
 *     summary: 전체 장수 목록 조회
 *     tags: [Global]
 *     responses:
 *       200:
 *         description: 장수 목록
 */
router.post('/general-list', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.body.session_id || req.query.session_id || req.body.serverID || req.query.serverID || 'sangokushi_default';
    
    const { General } = await import('../models');
    const generals = await General.find({ session_id: sessionId })
      .sort({ 'data.experience': -1 })
      .limit(1000)
      .lean();
    
    const generalList = generals.map((g: any) => {
      const genData = g.data || {};
      return {
        no: genData.no || g.no,
        name: g.name || genData.name || '',
        nation: genData.nation || 0,
        city: genData.city || 0,
        leadership: genData.leadership || 0,
        strength: genData.strength || 0,
        intel: genData.intel || 0,
        experience: genData.experience || 0,
        explevel: genData.explevel || 0,
        npc: genData.npc || 0
      };
    });
    
    res.json({
      result: true,
      generalList
    });
  } catch (error) {
    next(error);
  }
});

export default router;

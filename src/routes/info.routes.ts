// @ts-nocheck - Type issues need investigation
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
        reason: result.reason || ''
      });
    }
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/info/city:
 *   post:
 *     summary: 도시 정보 조회
 *     description: 특정 도시의 상세 정보를 조회합니다.
 *     tags: [Info]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - session_id
 *               - cityID
 *             properties:
 *               session_id:
 *                 type: string
 *                 example: sangokushi_default
 *               cityID:
 *                 type: number
 *                 description: 조회할 도시 ID
 *                 example: 1
 *     responses:
 *       200:
 *         description: 도시 정보 조회 성공
 */
router.post('/city', authenticate, async (req, res) => {
  try {
    const { session_id: sessionId, cityID } = req.body;
    const userId = req.user?.userId;
    
    if (!sessionId || cityID === undefined) {
      return res.status(400).json({ 
        result: false,
        error: 'session_id와 cityID가 필요합니다.' 
      });
    }

    const { City } = await import('../models/city.model');
    const { Nation } = await import('../models/nation.model');
    const { General } = await import('../models/general.model');

    const city = await City.findOne({ 
      session_id: sessionId, 
      city: parseInt(cityID) 
    }).lean();

    if (!city) {
      return res.json({ 
        result: false, 
        error: '도시를 찾을 수 없습니다.' 
      });
    }
    
    // 장수 조회 (권한 체크용)
    const general = await General.findOne({
      session_id: sessionId,
      owner: userId?.toString()
    }).lean();
    
    if (!general) {
      return res.json({ result: false, error: '장수를 찾을 수 없습니다' });
    }
    
    const myNationId = general.data?.nation || general.nation || 0;
    const cityNationId = city.data?.nation || city.nation || 0;
    
    // 권한 체크: 아군 도시, 공백지, 또는 스파이한 도시만 볼 수 있음
    const isMyNation = myNationId === cityNationId;
    const isNeutral = cityNationId === 0;
    
    let canView = isMyNation || isNeutral;
    
    // 타국 도시는 스파이 여부 확인
    if (!canView && myNationId > 0) {
      const myNation = await Nation.findOne({
        session_id: sessionId,
        nation: myNationId
      }).select('data.spy spy').lean();
      
      if (myNation) {
        const spyData = myNation.data?.spy || myNation.spy;
        if (spyData) {
          const spyCities = typeof spyData === 'string' ? JSON.parse(spyData || '{}') : spyData;
          canView = spyCities[cityID] !== undefined;
        }
      }
    }
    
    if (!canView) {
      return res.json({
        result: false,
        error: '타국 도시는 첩보를 넣어야 볼 수 있습니다.'
      });
    }

    // 국가 정보 조회
    let nationInfo = null;
    if (city.nation && city.nation > 0) {
      const nation = await Nation.findOne({ 
        session_id: sessionId, 
        nation: city.nation 
      }).lean();
      
      if (nation) {
        nationInfo = {
          id: nation.nation,
          name: nation.name,
          color: nation.color
        };
      }
    }

    // 관직자 정보 조회
    const officerList: any = {};
    for (const level of [2, 3, 4]) {
      const general = await General.findOne({
        session_id: sessionId,
        city: city.city,
        officer_level: level
      }).select('no name npc officer_level').lean();

      if (general) {
        officerList[level] = {
          officer_level: level,
          no: general.no,
          name: general.name,
          npc: general.npc
        };
      } else {
        officerList[level] = null;
      }
    }

    res.json({
      result: true,
      city: {
        id: city.city,
        name: city.name,
        nationInfo,
        level: city.level,
        trust: city.trust || 0,
        pop: [city.pop, city.pop_max],
        agri: [city.agri, city.agri_max],
        comm: [city.comm, city.comm_max],
        secu: [city.secu, city.secu_max],
        def: [city.def, city.def_max],
        wall: [city.wall, city.wall_max],
        trade: city.trade || null,
        officerList
      }
    });
  } catch (error: any) {
    console.error('도시 정보 조회 오류:', error);
    res.status(500).json({ 
      result: false,
      error: error.message 
    });
  }
});

export default router;

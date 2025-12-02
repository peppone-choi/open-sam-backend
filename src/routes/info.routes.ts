// @ts-nocheck - Type issues need investigation
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { GetGeneralInfoService } from '../services/info/GetGeneralInfo.service';
import { GetBettingListService } from '../services/betting/GetBettingList.service';
import { GetOfficerInfoService } from '../services/info/GetOfficerInfo.service';
import { GetTournamentInfoService } from '../services/info/GetTournamentInfo.service';
import { GetFrontInfoService } from '../services/general/GetFrontInfo.service';
import { cityRepository } from '../repositories/city.repository';
import { generalRepository } from '../repositories/general.repository';
import { nationRepository } from '../repositories/nation.repository';

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
    console.error('GetGeneralInfo error:', error);
    res.status(500).json({ result: false, reason: error.message || '장수 정보 조회 중 서버 오류가 발생했습니다' });
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
    console.error('GetOfficerInfo error:', error);
    res.status(500).json({ result: false, reason: error.message || '관직자 정보 조회 중 서버 오류가 발생했습니다' });
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
    console.error('GetTournamentInfo error:', error);
    res.status(500).json({ result: false, reason: error.message || '토너먼트 정보 조회 중 서버 오류가 발생했습니다' });
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
        bettingList: result.bettingList || [],
        year: result.year,
        month: result.month
      });
    } else {
      // 도메인 실패 (세션 없음 등)는 200 + result:false
      res.json({
        result: false,
        bettingList: [],
        reason: result.message || result.reason || ''
      });
    }
  } catch (error: any) {
    console.error('GetBettingList error:', error);
    res.status(500).json({ result: false, reason: error.message || '배팅 정보 조회 중 서버 오류가 발생했습니다' });
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

    const numericCityId = parseInt(cityID?.toString?.() ?? '0', 10);
    if (Number.isNaN(numericCityId)) {
      return res.status(400).json({
        result: false,
        error: '잘못된 도시 ID 입니다.'
      });
    }

    const city = await cityRepository.findByCityNum(sessionId, numericCityId);

    if (!city) {
      return res.json({
        result: false,
        error: '도시를 찾을 수 없습니다.'
      });
    }

    // 장수 조회 (권한 체크용)
    const ownerKey = userId?.toString();
    if (!ownerKey) {
      return res.json({ result: false, error: '장수를 찾을 수 없습니다' });
    }

    const general = await generalRepository.findBySessionAndOwner(sessionId, ownerKey);

    if (!general) {
      return res.json({
        result: false,
        error: '장수를 먼저 생성해주세요. 게임을 시작하려면 캐릭터를 생성하세요.'
      });
    }

    const myNationId = (general as any).data?.nation || (general as any).nation || 0;
    const cityNationId = city.data?.nation ?? city.nation ?? 0;

    // 권한 체크: 아군 도시, 공백지, 또는 스파이한 도시만 볼 수 있음
    const isMyNation = myNationId === cityNationId;
    const isNeutral = cityNationId === 0;

    let canView = isMyNation || isNeutral;

    // 타국 도시는 스파이 여부 확인
    if (!canView && myNationId > 0) {
      const myNation = await nationRepository.findByNationNum(sessionId, myNationId);

      if (myNation) {
        const nationData: any = typeof myNation.toObject === 'function' ? myNation.toObject() : myNation;
        const spyData = nationData.data?.spy ?? nationData.spy;
        if (spyData) {
          let spyCities: Record<string, any> = {};
          if (typeof spyData === 'string') {
            try {
              spyCities = JSON.parse(spyData || '{}');
            } catch (error) {
              spyCities = {};
            }
          } else if (typeof spyData === 'object') {
            spyCities = spyData;
          }
          if (spyCities[numericCityId] !== undefined) {
            canView = true;
          }
        }
      }
    }

    // 첩보 없는 타국 도시: 기본 정보만 공개, 상세 정보 마스킹
    if (!canView) {
      const cityData: any = typeof city.toObject === 'function' ? city.toObject() : city;
      const nation = cityNationId > 0 
        ? await nationRepository.findByNationNum(sessionId, cityNationId)
        : null;
      
      const restrictedCity = {
        city: numericCityId,
        name: cityData.name || cityData.data?.name || `도시 ${numericCityId}`,
        nation: cityNationId,
        nationName: nation?.name || '???',
        nationColor: nation?.color || '#888888',
        level: cityData.level ?? cityData.data?.level ?? 5,
        region: cityData.region ?? cityData.data?.region ?? 0,
        x: cityData.x ?? cityData.data?.x ?? 0,
        y: cityData.y ?? cityData.data?.y ?? 0,
        // 첩보 없으면 상세 정보 마스킹
        pop: null,        // ???
        trust: null,      // ???
        agri: null,       // ???
        comm: null,       // ???
        secu: null,       // ???
        def: null,        // ???
        wall: null,       // ???
        generals: [],     // 장수 목록 비공개
        restricted: true  // 제한된 정보임을 표시
      };

      return res.json({
        result: true,
        city: restrictedCity,
        restricted: true,
        message: '첩보가 없어 일부 정보가 제한됩니다.'
      });
    }

    const cityInfo = await GetFrontInfoService.generateCityInfo(sessionId, numericCityId, myNationId);
    if (!cityInfo) {
      return res.json({
        result: false,
        error: '도시 정보를 생성할 수 없습니다.'
      });
    }

    res.json({
      result: true,
      city: cityInfo,
      restricted: false
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

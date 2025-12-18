import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { GetChiefCenterService } from '../services/chief/GetChiefCenter.service';
import { OfficerSystemService, OfficerLevel, Permission } from '../services/nation/OfficerSystem.service';
import { KickGeneralService } from '../services/nation/KickGeneral.service';
import { generalRepository } from '../repositories/general.repository';

const router = Router();

/**
 * @swagger
 * /api/chief/center:
 *   post:
 *     summary: 제왕 센터
 *     description: 제왕(군주)의 특수 기능 및 정보를 조회합니다.
 *     tags: [Chief]
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
 *         description: 제왕 센터 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                 center:
 *                   type: object
 */
router.post('/center', authenticate, async (req, res) => {
  try {
    const result = await GetChiefCenterService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/chief/appoint:
 *   post:
 *     summary: 관직 임명
 *     description: 장수를 특정 관직에 임명합니다.
 *     tags: [Chief]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *               - destGeneralID
 *               - officerLevel
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [임명]
 *               destGeneralID:
 *                 type: number
 *               officerLevel:
 *                 type: number
 *               destCityID:
 *                 type: number
 *     responses:
 *       200:
 *         description: 임명 성공
 */
router.post('/appoint', authenticate, async (req, res) => {
  try {
    const sessionId = req.body.session_id || req.query.session_id || 'sangokushi_default';
    const userId = req.user?.userId || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }
    
    const { action, officerLevel, destGeneralID, destCityID } = req.body;
    
    // 내 장수 조회
    const myGeneral = await generalRepository.findBySessionAndOwner(sessionId, String(userId));
    if (!myGeneral) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }
    
    const myOfficerLevel = myGeneral.data?.officer_level || 0;
    
    // 수뇌 권한 체크
    if (myOfficerLevel < 5) {
      return res.json({ result: false, reason: '수뇌가 아닙니다.' });
    }
    
    if (action === '임명') {
      const targetLevel = parseInt(officerLevel);
      const targetGeneralId = parseInt(destGeneralID);
      const targetCityId = destCityID ? parseInt(destCityID) : undefined;
      
      if (!targetGeneralId || isNaN(targetLevel)) {
        return res.json({ result: false, reason: '잘못된 파라미터입니다.' });
      }
      
      // 지방관(2~4) vs 수뇌부(5~11) 분기
      if (targetLevel >= 2 && targetLevel <= 4) {
        if (!targetCityId) {
          return res.json({ result: false, reason: '도시가 지정되지 않았습니다.' });
        }
      }
      
      if (targetLevel >= 12) {
        return res.json({ result: false, reason: '군주를 대상으로 할 수 없습니다.' });
      }
      
      const myGeneralNo = myGeneral.no || myGeneral.data?.no;
      const result = await OfficerSystemService.appointOfficer(
        sessionId,
        myGeneralNo,
        targetGeneralId,
        targetLevel,
        targetCityId
      );
      
      return res.json({
        result: result.success,
        reason: result.success ? 'success' : result.message
      });
    }
    
    return res.json({ result: false, reason: '올바르지 않은 명령입니다.' });
  } catch (error: any) {
    console.error('Error in chief/appoint:', error);
    res.status(500).json({ result: false, reason: error.message });
  }
});

/**
 * @swagger
 * /api/chief/kick:
 *   post:
 *     summary: 장수 추방
 *     description: 소속 장수를 추방합니다.
 *     tags: [Chief]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - destGeneralID
 *             properties:
 *               destGeneralID:
 *                 type: number
 *     responses:
 *       200:
 *         description: 추방 성공
 */
router.post('/kick', authenticate, async (req, res) => {
  try {
    const sessionId = req.body.session_id || req.query.session_id || 'sangokushi_default';
    const userId = req.user?.userId || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }
    
    const { destGeneralID } = req.body;
    
    const myGeneral = await generalRepository.findBySessionAndOwner(sessionId, String(userId));
    if (!myGeneral) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }
    
    const myGeneralNo = myGeneral.no || myGeneral.data?.no;
    
    const result = await KickGeneralService.execute({
      session_id: sessionId,
      general_id: myGeneralNo,
      target_general_id: parseInt(destGeneralID)
    }, req.user);
    
    return res.json({
      result: result.success,
      reason: result.success ? 'success' : result.message
    });
  } catch (error: any) {
    console.error('Error in chief/kick:', error);
    res.status(500).json({ result: false, reason: error.message });
  }
});

/**
 * @swagger
 * /api/chief/set-permission:
 *   post:
 *     summary: 권한 설정 (외교권자/감찰관)
 *     description: 장수에게 특수 권한을 부여하거나 해제합니다.
 *     tags: [Chief]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isAmbassador
 *             properties:
 *               isAmbassador:
 *                 type: boolean
 *                 description: true=외교권자, false=감찰관
 *               genlist:
 *                 type: array
 *                 items:
 *                   type: number
 *                 description: 권한 부여할 장수 ID 목록 (비어있으면 해제)
 *     responses:
 *       200:
 *         description: 권한 설정 성공
 */
router.post('/set-permission', authenticate, async (req, res) => {
  try {
    const sessionId = req.body.session_id || req.query.session_id || 'sangokushi_default';
    const userId = req.user?.userId || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }
    
    const { isAmbassador, genlist } = req.body;
    
    // 내 장수 조회
    const myGeneral = await generalRepository.findBySessionAndOwner(sessionId, String(userId));
    if (!myGeneral) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }
    
    const myOfficerLevel = myGeneral.data?.officer_level || 0;
    const nationId = myGeneral.data?.nation || 0;
    
    // 군주 권한 체크
    if (myOfficerLevel !== 12) {
      return res.json({ result: false, reason: '군주가 아닙니다' });
    }
    
    const targetPermission = isAmbassador ? Permission.AMBASSADOR : Permission.AUDITOR;
    
    // 외교권자는 최대 2명
    if (isAmbassador && genlist && genlist.length > 2) {
      return res.json({ result: false, reason: '외교권자는 최대 둘까지만 설정 가능합니다.' });
    }
    
    // 기존 권한 해제
    const generalsWithPermission = await generalRepository.findByFilter({
      session_id: sessionId,
      'data.nation': nationId,
      'data.permission': targetPermission
    });
    
    for (const general of generalsWithPermission) {
      const genNo = general.no || general.data?.no;
      await generalRepository.updateBySessionAndNo(sessionId, genNo, {
        'data.permission': Permission.NORMAL
      });
    }
    
    // 새로운 권한 부여
    if (genlist && Array.isArray(genlist) && genlist.length > 0) {
      const myGeneralNo = myGeneral.no || myGeneral.data?.no;
      
      for (const targetId of genlist) {
        const result = await OfficerSystemService.grantSpecialPermission(
          sessionId,
          myGeneralNo,
          parseInt(targetId),
          targetPermission
        );
        
        if (!result.success) {
          console.warn(`Failed to grant permission to ${targetId}: ${result.message}`);
        }
      }
    }
    
    return res.json({ result: true, reason: 'success' });
  } catch (error: any) {
    console.error('Error in chief/set-permission:', error);
    res.status(500).json({ result: false, reason: error.message });
  }
});

/**
 * @swagger
 * /api/chief/officers:
 *   post:
 *     summary: 국가 관직자 목록 조회
 *     description: 국가의 모든 관직자 목록을 조회합니다.
 *     tags: [Chief]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 관직자 목록 조회 성공
 */
router.post('/officers', authenticate, async (req, res) => {
  try {
    const sessionId = req.body.session_id || req.query.session_id || 'sangokushi_default';
    const userId = req.user?.userId || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }
    
    const myGeneral = await generalRepository.findBySessionAndOwner(sessionId, String(userId));
    if (!myGeneral) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }
    
    const nationId = myGeneral.data?.nation || 0;
    if (nationId === 0) {
      return res.json({ result: false, reason: '국가에 소속되어 있지 않습니다.' });
    }
    
    const officers = await OfficerSystemService.getNationOfficers(sessionId, nationId);
    const slotInfo = await OfficerSystemService.getChiefSlotInfo(sessionId, nationId);
    
    return res.json({
      result: true,
      officers,
      slotInfo
    });
  } catch (error: any) {
    console.error('Error in chief/officers:', error);
    res.status(500).json({ result: false, reason: error.message });
  }
});

export default router;

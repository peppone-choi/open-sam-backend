// @ts-nocheck - Type issues need investigation
import { Router, Request, Response } from 'express';
import { General, Nation, City } from '../../models';

const router = Router();

/**
 * 권한 체크 헬퍼 (수뇌부 권한)
 */
function checkSecretPermission(general: any): number {
  const officerLevel = general?.data?.officer_level || general?.officer_level || 0;
  const permission = general?.data?.permission || general?.permission || 0;
  
  if (officerLevel >= 11) return 5;
  if ((permission & 0x04) !== 0) return 4;
  return 0;
}

router.get('/general-list', async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.session_id || 'sangokushi_default';
    
    const generals = await General.find({ session_id: sessionId, 'data.npc': 0 })
      .select('data.no data.name data.nation data.city data.leadership data.strength data.intel data.crew data.crewtype data.officer_level')
      .lean();

    res.json({
      result: true,
      generals: generals.map((g: any) => ({
        no: g.data?.no,
        name: g.data?.name,
        nation: g.data?.nation,
        city: g.data?.city,
        leadership: g.data?.leadership,
        strength: g.data?.strength,
        intel: g.data?.intel,
        crew: g.data?.crew,
        crewtype: g.data?.crewtype,
        officerLevel: g.data?.officer_level,
      })),
    });
  } catch (error) {
    console.error('Error in general-list:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

router.get('/general-log', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.query.session_id || 'sangokushi_default';
    
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general = await General.findOne({ session_id: sessionId, owner: userId }).select('data.no').lean();
    if (!general) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    const logs: any[] = [];

    res.json({
      result: true,
      logs,
    });
  } catch (error) {
    console.error('Error in general-log:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

/**
 * POST /general-log-old - 과거 로그 조회 (PHP: j_general_log_old.php)
 * type: generalAction, battleResult, battleDetail
 */
router.post('/general-log-old', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.body.session_id || req.query.session_id || 'sangokushi_default';
    
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const { general_id, to, type } = req.body;
    const reqTo = parseInt(to) || Number.MAX_SAFE_INTEGER;
    const reqType = type || 'generalAction';

    if (!['generalAction', 'battleResult', 'battleDetail'].includes(reqType)) {
      return res.status(400).json({ result: false, reason: '요청 타입이 올바르지 않습니다.' });
    }

    // 내 장수 정보 조회
    const me: any = await General.findOne({ session_id: sessionId, owner: userId }).lean();
    if (!me) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    const myGeneralId = me.data?.no || me.no;
    const myNationId = me.data?.nation || me.nation || 0;
    const targetId = parseInt(general_id) || myGeneralId;

    // 자기 자신이 아닌 경우 권한 체크
    if (targetId !== myGeneralId) {
      const targetGeneral: any = await General.findOne({ 
        session_id: sessionId, 
        'data.no': targetId 
      }).lean();

      if (!targetGeneral) {
        return res.status(404).json({ result: false, reason: '대상 장수를 찾을 수 없습니다.' });
      }

      const targetNationId = targetGeneral.data?.nation || targetGeneral.nation || 0;
      const targetNpc = targetGeneral.data?.npc || targetGeneral.npc || 0;

      const permission = checkSecretPermission(me);
      if (permission < 0) {
        return res.status(403).json({ result: false, reason: '국가에 소속되어있지 않습니다.' });
      }
      if (permission < 1 && targetNpc < 2) {
        return res.status(403).json({ result: false, reason: '권한이 부족합니다. 수뇌부가 아니거나 사관년도가 부족합니다.' });
      }
      if (targetNationId !== myNationId) {
        return res.status(403).json({ result: false, reason: '동일한 국가의 장수가 아닙니다.' });
      }
    }

    // 로그 조회
    const { GeneralRecord } = await import('../../models/general_record.model');
    
    let logType: string;
    switch (reqType) {
      case 'generalAction':
        logType = 'action';
        break;
      case 'battleResult':
        logType = 'battle_brief';
        break;
      case 'battleDetail':
        logType = 'battle';
        break;
      default:
        logType = 'action';
    }

    const logs = await GeneralRecord.find({
      session_id: sessionId,
      general_id: targetId,
      log_type: logType,
      _id: { $lt: reqTo }
    })
      .sort({ _id: -1 })
      .limit(30)
      .lean();

    const formattedLogs = logs.map((log: any) => ({
      id: log._id?.toString(),
      text: log.text || '',
      year: log.year,
      month: log.month,
      date: log.created_at
    }));

    res.json({
      result: true,
      reason: 'success',
      log: formattedLogs
    });
  } catch (error) {
    console.error('Error in general-log-old:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

/**
 * POST /general-set-permission - 장수 권한 설정
 * PHP: j_general_set_permission.php
 */
router.post('/general-set-permission', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.body.session_id || req.query.session_id || 'sangokushi_default';
    
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const { targetGeneralId, permission } = req.body;

    // 내 장수 정보 조회
    const me: any = await General.findOne({ session_id: sessionId, owner: userId }).lean();
    if (!me) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    const myOfficerLevel = me.data?.officer_level || me.officer_level || 0;
    if (myOfficerLevel < 11) { // 참모 이상만
      return res.status(403).json({ result: false, reason: '권한이 부족합니다. 참모 이상만 가능합니다.' });
    }

    const targetGeneral: any = await General.findOne({
      session_id: sessionId,
      'data.no': targetGeneralId
    });

    if (!targetGeneral) {
      return res.status(404).json({ result: false, reason: '대상 장수를 찾을 수 없습니다.' });
    }

    // 같은 국가인지 확인
    const myNationId = me.data?.nation || me.nation || 0;
    const targetNationId = targetGeneral.data?.nation || targetGeneral.nation || 0;
    if (myNationId !== targetNationId) {
      return res.status(403).json({ result: false, reason: '같은 국가의 장수만 권한을 설정할 수 있습니다.' });
    }

    // 권한 설정
    targetGeneral.data = targetGeneral.data || {};
    targetGeneral.data.permission = parseInt(permission) || 0;
    targetGeneral.markModified('data');
    await targetGeneral.save();

    res.json({
      result: true,
      reason: 'success',
      message: '권한이 설정되었습니다.'
    });
  } catch (error) {
    console.error('Error in general-set-permission:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

export default router;

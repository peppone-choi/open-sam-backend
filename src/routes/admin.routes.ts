import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { General } from '../models/general.model';
import { User } from '../models/user.model';
import { Session } from '../models/session.model';
import { Nation } from '../models/nation.model';
import { City } from '../models/city.model';
import { SessionStateService } from '../services/sessionState.service';

const router = Router();

// 모든 admin 라우트에 인증 필요 (grade >= 5)
router.use(authenticate);

// 권한 체크 미들웨어
const requireAdmin = (req: any, res: any, next: any) => {
  const grade = req.user?.grade || 0;
  if (grade < 5 && req.user?.acl !== '*') {
    return res.status(403).json({
      result: false,
      reason: '관리자 권한이 필요합니다'
    });
  }
  next();
};

router.use(requireAdmin);

/**
 * @swagger
 * /api/admin/userlist:
 *   post:
 *     summary: 사용자 목록 조회
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/userlist', async (req, res) => {
  try {
    const users = await (User as any).find({})
      .select('username name grade picture createdAt')
      .lean()
      .limit(1000);
    
    res.json({
      result: true,
      users: users.map((u: any) => ({
        no: u._id,
        name: u.username || u.name || '',
        grade: u.grade || 1,
        picture: u.picture || '',
        join_date: u.createdAt || new Date(),
      }))
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/admin/update-user:
 *   post:
 *     summary: 사용자 정보 수정
 *     tags: [Admin]
 */
router.post('/update-user', async (req, res) => {
  try {
    const { userID, action, data } = req.body;
    
    if (!userID) {
      return res.status(400).json({
        result: false,
        reason: '사용자 ID가 필요합니다'
      });
    }
    
    const user = await (User as any).findById(userID);
    if (!user) {
      return res.status(404).json({
        result: false,
        reason: '사용자를 찾을 수 없습니다'
      });
    }
    
    // action에 따른 수정
    if (action === 'grade') {
      user.grade = data.grade || user.grade;
    } else if (action === 'name') {
      user.name = data.name || user.name;
    } else if (action === 'acl') {
      user.acl = data.acl || user.acl;
    } else if (action === 'block') {
      user.block = data.block !== undefined ? data.block : user.block;
    }
    
    await user.save();
    
    res.json({
      result: true,
      reason: '수정되었습니다'
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/admin/error-log:
 *   post:
 *     summary: 에러 로그 조회
 *     tags: [Admin]
 */
router.post('/error-log', async (req, res) => {
  try {
    const { from = 0, limit = 100 } = req.body;
    
    // 에러 로그 조회 (파일 또는 DB)
    // TODO: 실제 로그 파일 읽기 또는 DB에서 조회
    const errorLogs: any[] = [];
    
    // 예시: 로그 파일이 있다면 읽기
    // const fs = require('fs');
    // const logPath = path.join(__dirname, '../../logs/error.log');
    // if (fs.existsSync(logPath)) {
    //   const logs = fs.readFileSync(logPath, 'utf-8').split('\n').slice(-100);
    //   errorLogs.push(...logs);
    // }
    res.json({
      result: true,
      errorLogs: []
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/admin/diplomacy:
 *   post:
 *     summary: 외교 정보 조회
 *     tags: [Admin]
 */
router.post('/diplomacy', async (req, res) => {
  try {
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    
    // NgDiplomacy 모델 사용
    const { NgDiplomacy } = await import('../models');
    const NgDiplomacyModel = NgDiplomacy as any;
    
    const letters = await NgDiplomacyModel.find({
      session_id: sessionId
    })
      .sort({ 'data.date': -1 })
      .limit(100)
      .lean();
    
    const diplomacyList = letters.map((letter: any) => {
      const letterData = letter.data || {};
      return {
        no: letterData.no || letter._id,
        srcNationId: letterData.srcNationId || 0,
        destNationId: letterData.destNationId || 0,
        brief: letterData.brief || letterData.text || '',
        status: letterData.status || 'pending',
        date: letterData.date || letter.createdAt
      };
    });
    
    res.json({
      result: true,
      diplomacyList
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/admin/game-info:
 *   post:
 *     summary: 게임 정보 조회
 *     tags: [Admin]
 */
router.post('/game-info', async (req, res) => {
  try {
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    
    const session = await (Session as any).findOne({ session_id: sessionId }).lean();
    const sessionData = session?.data || {};
    
    res.json({
      result: true,
      gameInfo: {
        msg: sessionData.noticeMsg || '',
        turnterm: sessionData.turnterm || 0,
        year: sessionData.year || 0,
        month: sessionData.month || 0,
        ...sessionData
      }
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/admin/update-game:
 *   post:
 *     summary: 게임 정보 수정
 *     tags: [Admin]
 */
router.post('/update-game', async (req, res) => {
  try {
    const { action, data } = req.body;
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    
    const session = await (Session as any).findOne({ session_id: sessionId });
    if (!session) {
      return res.status(404).json({
        result: false,
        reason: '세션을 찾을 수 없습니다'
      });
    }
    
    // 게임 정보 업데이트
    session.data = session.data || {};
    
    if (action === 'msg') {
      session.data.noticeMsg = data.msg || '';
    } else if (action === 'turnterm') {
      session.data.turnterm = data.turnterm || 1440;
    } else if (action === 'year') {
      session.data.year = data.year || session.data.year || 180;
    } else if (action === 'month') {
      session.data.month = data.month || session.data.month || 1;
    } else if (action === 'status') {
      session.status = data.status || session.status || 'running';
    } else if (action === 'lock') {
      const locked = data.locked !== undefined ? data.locked : false;
      await SessionStateService.updateSessionState(sessionId, {
        isLocked: locked,
        status: locked ? 'paused' : 'running'
      });
    } else if (action === 'block_create') {
      session.data.block_general_create = data.block_create !== undefined ? data.block_create : 0;
    }
    
    await session.save();
    
    res.json({
      result: true,
      reason: '변경되었습니다'
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/admin/info:
 *   post:
 *     summary: 관리 정보 조회
 *     tags: [Admin]
 */
router.post('/info', async (req, res) => {
  try {
    const { type = 0, type2 = 0 } = req.body;
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    
    let infoList: any[] = [];
    
    // type에 따른 정보 조회
    if (type === 0) {
      // 전체 통계
      const generalCount = await (General as any).countDocuments({ session_id: sessionId });
      const nationCount = await (Nation as any).countDocuments({ session_id: sessionId });
      const cityCount = await (City as any).countDocuments({ session_id: sessionId });
      const userCount = await (User as any).countDocuments({});
      
      infoList = [
        { name: '총 장수', value: generalCount },
        { name: '총 국가', value: nationCount },
        { name: '총 도시', value: cityCount },
        { name: '총 사용자', value: userCount }
      ];
    } else if (type === 1) {
      // 장수 정보
      const generals = await (General as any).find({ session_id: sessionId })
        .sort({ 'data.turntime': -1 })
        .limit(100)
        .lean();
      
      infoList = generals.map((g: any) => ({
        no: g.data?.no || g.no,
        name: g.name || g.data?.name || '',
        nation: g.data?.nation || 0,
        city: g.data?.city || 0
      }));
    } else if (type === 2) {
      // 국가 정보
      const nations = await (Nation as any).find({ session_id: sessionId }).lean();
      
      infoList = nations.map((n: any) => ({
        nation: n.data?.nation || n.nation,
        name: n.name || n.data?.name || '',
        level: n.data?.level || 0,
        gennum: n.data?.gennum || 0
      }));
    } else if (type === 3) {
      // 도시 정보
      const cities = await (City as any).find({ session_id: sessionId }).lean();
      
      infoList = cities.map((c: any) => ({
        id: c.city || c.data?.id || 0,
        name: c.name || c.data?.name || '',
        nation: c.data?.nation || c.nation || 0
      }));
    }
    
    res.json({
      result: true,
      infoList
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/admin/general:
 *   post:
 *     summary: 장수 정보 조회 (관리자)
 *     tags: [Admin]
 */
router.post('/general', async (req, res) => {
  try {
    const { generalID } = req.body;
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    
    let query: any = { session_id: sessionId };
    if (generalID) {
      query['data.no'] = generalID;
    }
    
    const generals = await (General as any).find(query)
      .sort({ 'data.turntime': -1 })
      .limit(1000)
      .lean();
    
    const generalList = generals.map((g: any) => ({
      no: g.data?.no || g.no,
      name: g.name || g.data?.name || '',
      nation: g.data?.nation || 0,
      city: g.data?.city || 0,
      turntime: g.data?.turntime || '',
      // ... 기타 정보
    }));
    
    res.json({
      result: true,
      general: generalList.length === 1 ? generalList[0] : generalList
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/admin/member:
 *   post:
 *     summary: 회원 정보 조회 (관리자)
 *     tags: [Admin]
 */
router.post('/member', async (req, res) => {
  try {
    const { memberID } = req.body;
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    
    let query: any = {};
    if (memberID) {
      query._id = memberID;
    }
    
    const users = await (User as any).find(query)
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();
    
    const members = users.map((user: any) => ({
      id: user._id.toString(),
      username: user.username || '',
      name: user.name || user.username || '',
      grade: user.grade || 1,
      createdAt: user.createdAt,
      oauth_type: user.oauth_type || null
    }));
    
    res.json({
      result: true,
      members: memberID ? (members[0] || null) : members
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/admin/time-control:
 *   post:
 *     summary: 시간 제어 정보 조회
 *     tags: [Admin]
 */
router.post('/time-control', async (req, res) => {
  try {
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    
    const session = await (Session as any).findOne({ session_id: sessionId }).lean();
    const sessionData = session?.data || {};
    
    res.json({
      result: true,
      timeControl: {
        turnterm: sessionData.turnterm || 0,
        lastExecuted: sessionData.lastExecuted || '',
        // ... 기타 시간 제어 정보
      }
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/admin/update-time-control:
 *   post:
 *     summary: 시간 제어 수정
 *     tags: [Admin]
 */
router.post('/update-time-control', async (req, res) => {
  try {
    const { action, data } = req.body;
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    
    const session = await (Session as any).findOne({ session_id: sessionId });
    if (!session) {
      return res.status(404).json({
        result: false,
        reason: '세션을 찾을 수 없습니다'
      });
    }
    
    session.data = session.data || {};
    
    if (action === 'turnterm') {
      session.data.turnterm = data.turnterm || 1440;
    } else if (action === 'lastExecuted') {
      session.data.lastExecuted = data.lastExecuted || new Date();
    }
    
    await session.save();
    
    res.json({
      result: true,
      reason: '변경되었습니다'
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/admin/force-rehall:
 *   post:
 *     summary: 강제 재합류
 *     tags: [Admin]
 */
router.post('/force-rehall', async (req, res) => {
  try {
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    
    // 세션 확인 (천통 여부 체크)
    const session = await (Session as any).findOne({ session_id: sessionId }).lean();
    if (!session) {
      return res.status(404).json({
        result: false,
        reason: '세션을 찾을 수 없습니다'
      });
    }
    
    const sessionData = session.data || {};
    if (!sessionData.isunited) {
      return res.status(400).json({
        result: false,
        reason: '아직 천통하지 않았습니다'
      });
    }
    
    // 40세 이상이고 NPC가 아닌 장수들에 대해 CheckHall 실행
    const { CheckHallService } = await import('../services/admin/CheckHall.service');
    const { InheritancePointManager } = await import('../core/inheritance/InheritancePointManager');
    
    const generals = await (General as any).find({
      session_id: sessionId,
      'data.npc': { $lt: 2 },
      'data.age': { $gte: 40 }
    });
    
    const processed: number[] = [];
    for (const general of generals) {
      const genData = general.data || {};
      const generalNo = genData.no || general.no;
      
      // CheckHall 실행
      await CheckHallService.execute(generalNo, sessionId);
      processed.push(generalNo);
    }
    
    // 상속 포인트 계산 (NPC가 아닌 장수들)
    const playerGenerals = await (General as any).find({
      session_id: sessionId,
      'data.npc': 0
    });
    
    for (const general of playerGenerals) {
      const genData = general.data || {};
      const owner = general.owner;
      
      if (owner) {
        // 상속 포인트 계산 및 적용
        const experience = genData.experience || 0;
        const dedication = genData.dedication || 0;
        const inheritPoints = Math.floor((experience + dedication * 2) / 100);
        
        if (inheritPoints > 0) {
          genData.inherit_points = (genData.inherit_points || 0) + inheritPoints;
          await general.save();
        }
      }
    }
    
    res.json({
      result: true,
      reason: '처리되었습니다',
      processedCount: processed.length
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

export default router;


import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { General } from '../models/general.model';
import { User } from '../models/user.model';
import { Session } from '../models/session.model';
import { Nation } from '../models/nation.model';
import { City } from '../models/city.model';

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
    
    // TODO: 실제 사용자 수정 로직 구현
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
    
    // TODO: 실제 에러 로그 조회 구현 (로그 파일 또는 DB)
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
    
    // TODO: 외교 정보 조회 구현
    res.json({
      result: true,
      diplomacyList: []
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
    if (action === 'msg') {
      session.data = session.data || {};
      session.data.noticeMsg = data.msg || '';
      await session.save();
    }
    
    // TODO: 다른 action 처리 구현
    
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
    
    // TODO: type에 따른 정보 조회 구현
    res.json({
      result: true,
      infoList: []
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
    
    // TODO: 회원 정보 조회 구현
    res.json({
      result: true,
      members: []
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
    
    // TODO: 시간 제어 수정 구현
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
    const { generalID } = req.body || {};
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    
    // TODO: 강제 재합류 로직 구현
    res.json({
      result: true,
      reason: '처리되었습니다'
    });
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

export default router;


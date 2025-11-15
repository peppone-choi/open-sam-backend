// @ts-nocheck - Type issues need investigation
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { Session } from '../models/session.model';
import { General } from '../models/general.model';
import { Nation } from '../models/nation.model';
import { City } from '../models/city.model';
import { GeneralTurn } from '../models/general_turn.model';
import { NationTurn } from '../models/nation_turn.model';
import { Message } from '../models/message.model';

const router = Router();

/**
 * 관리자 권한 체크
 */
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || (req.user.grade || 0) < 5) {
    return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다' });
  }
  next();
};

/**
 * @swagger
 * /api/admin/session/list:
 *   get:
 *     summary: 세션 목록 조회
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/list', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await Session.find({}, {
      session_id: 1,
      'data.scenario': 1,
      'data.year': 1,
      'data.month': 1,
      'data.turnterm': 1,
      'data.turntime': 1,
      'data.isunited': 1,
      created_at: 1,
      updated_at: 1,
    }).lean();
    
    const sessionList = sessions.map((s: any) => ({
      sessionId: s.session_id,
      scenario: s.data?.scenario || '시나리오 없음',
      year: s.data?.year,
      month: s.data?.month,
      turnterm: s.data?.turnterm,
      turntime: s.data?.turntime,
      status: s.data?.isunited === 2 ? 'closed' : s.data?.isunited === 3 ? 'united' : 'running',
      statusText: s.data?.isunited === 2 ? '폐쇄' : s.data?.isunited === 3 ? '천통' : '운영중',
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));
    
    res.json({
      success: true,
      sessions: sessionList,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/session/create:
 *   post:
 *     summary: 새 세션 생성
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/create', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, scenario, turnterm, config } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId가 필요합니다' });
    }
    
    // 중복 확인
    const existing = await Session.findOne({ session_id: sessionId });
    if (existing) {
      return res.status(400).json({ success: false, message: '이미 존재하는 세션 ID입니다' });
    }
    
    // 세션 생성
    const sessionData = {
      session_id: sessionId,
      data: {
        scenario: scenario || '새 서버',
        turnterm: turnterm || 60,
        isunited: 2,  // 폐쇄 상태로 시작
        startyear: 200,
        year: 200,
        month: 1,
        joinMode: config?.joinMode || 'full',
        npcMode: config?.npcMode || 0,
        extendedGeneral: config?.extendedGeneral || 1,
        isFiction: config?.isFiction || 0,
        tournamentType: null,
        tournamentState: 0,
        isTournamentActive: false,
        isTournamentApplicationOpen: false,
        isBettingActive: false,
        isLocked: false,
        scenarioText: scenario || '새 서버입니다.',
        noticeMsg: 0,
        apiLimit: 100,
        auctionCount: 0,
        genCount: [],
        generalCntLimit: 100,
        serverCnt: 1,
        lastVoteID: 0,
        lastVote: null,
        develCost: 1000,
        turntime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        lastExecuted: new Date().toISOString(),
        ...config,
      },
      created_at: new Date(),
      updated_at: new Date(),
    };
    
    const session = await Session.create(sessionData);
    
    res.json({
      success: true,
      message: '세션이 생성되었습니다 (폐쇄 상태)',
      session: {
        sessionId: session.session_id,
        scenario: session.data.scenario,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/session/open:
 *   post:
 *     summary: 세션 오픈
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/open', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.body;
    
    const session = await Session.findOne({ session_id: sessionId });
    if (!session) {
      return res.status(404).json({ success: false, message: '세션을 찾을 수 없습니다' });
    }
    
    session.data.isunited = 0;  // 운영 중
    session.data.turntime = new Date(Date.now() + (session.data.turnterm || 60) * 60 * 1000).toISOString();
    session.markModified('data');
    session.updated_at = new Date();
    await session.save();
    
    // Redis 캐시 무효화
    try {
      const { cacheManager } = await import('../cache/CacheManager');
      await cacheManager.delete(`session:state:${sessionId}`);
      await cacheManager.delete(`session:byId:${sessionId}`);
    } catch (error) {
      console.warn(`[AdminSession] Failed to invalidate cache:`, error);
    }
    
    res.json({
      success: true,
      message: '세션이 오픈되었습니다',
      session: {
        sessionId: session.session_id,
        status: 'running',
        nextTurntime: session.data.turntime,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/session/close:
 *   post:
 *     summary: 세션 폐쇄
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/close', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.body;
    
    const session = await Session.findOne({ session_id: sessionId });
    if (!session) {
      return res.status(404).json({ success: false, message: '세션을 찾을 수 없습니다' });
    }
    
    session.data.isunited = 2;  // 폐쇄
    session.markModified('data');
    session.updated_at = new Date();
    await session.save();
    
    // Redis 캐시 무효화
    try {
      const { cacheManager } = await import('../cache/CacheManager');
      await cacheManager.delete(`session:state:${sessionId}`);
      await cacheManager.delete(`session:byId:${sessionId}`);
    } catch (error) {
      console.warn(`[AdminSession] Failed to invalidate cache:`, error);
    }
    
    res.json({
      success: true,
      message: '세션이 폐쇄되었습니다',
      session: {
        sessionId: session.session_id,
        status: 'closed',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/session/reset:
 *   post:
 *     summary: 세션 리셋 (모든 데이터 삭제)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/reset', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.body;
    
    if ((req.user?.grade || 0) < 6) {
      return res.status(403).json({ success: false, message: '세션 리셋은 최고 관리자만 가능합니다 (grade >= 6)' });
    }
    
    const session = await Session.findOne({ session_id: sessionId });
    if (!session) {
      return res.status(404).json({ success: false, message: '세션을 찾을 수 없습니다' });
    }
    
    // 모든 관련 데이터 삭제
    await General.deleteMany({ session_id: sessionId });
    await Nation.deleteMany({ session_id: sessionId });
    await City.deleteMany({ session_id: sessionId });
    await GeneralTurn.deleteMany({ session_id: sessionId });
    await NationTurn.deleteMany({ session_id: sessionId });
    await Message.deleteMany({ session_id: sessionId });
    
    // 세션 초기화
    // startYear 우선순위: session.startyear > data.game_env.startyear > data.startyear > 기본값 184
    const startyear = session.startyear || session.data?.game_env?.startyear || session.data?.startyear || 184;
    
    if (!session.data) session.data = {};
    if (!session.data.game_env) session.data.game_env = {};
    
    session.data.year = startyear;
    session.data.month = 1;
    session.data.isunited = 2;  // 폐쇄
    session.data.turntime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    session.data.lastExecuted = new Date().toISOString();
    session.data.game_env.year = startyear;
    session.data.game_env.month = 1;
    session.data.game_env.isunited = 2;
    session.data.game_env.develcost = session.data.game_env.develcost || 100;
    session.data.game_env.killturn = session.data.game_env.killturn || 30;
    session.data.game_env.scenario = session.data.game_env.scenario || 0;
    session.data.game_env.allow_rebellion = session.data.game_env.allow_rebellion ?? true;
    session.year = startyear;
    session.month = 1;
    session.startyear = startyear;
    
    session.markModified('data');
    session.markModified('data.game_env');
    session.updated_at = new Date();
    await session.save();
    
    // Redis 캐시 무효화
    try {
      const { cacheManager } = await import('../cache/CacheManager');
      await cacheManager.delete(`session:state:${sessionId}`);
      await cacheManager.delete(`session:byId:${sessionId}`);
    } catch (error) {
      console.warn(`[AdminSession] Failed to invalidate cache:`, error);
    }
    
    res.json({
      success: true,
      message: '세션이 리셋되었습니다',
      session: {
        sessionId: session.session_id,
        status: 'closed',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/session/update:
 *   post:
 *     summary: 세션 데이터 업데이트 (MongoDB + Redis 캐시 동기화)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/update', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, data } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId가 필요합니다' });
    }
    
    const session = await Session.findOne({ session_id: sessionId });
    if (!session) {
      return res.status(404).json({ success: false, message: '세션을 찾을 수 없습니다' });
    }
    
    // 세션 데이터 업데이트
    if (data.year !== undefined) {
      if (!session.data) session.data = {};
      if (!session.data.game_env) session.data.game_env = {};
      session.data.year = data.year;
      session.data.game_env.year = data.year;
      session.year = data.year;
    }
    
    if (data.month !== undefined) {
      if (!session.data) session.data = {};
      if (!session.data.game_env) session.data.game_env = {};
      session.data.month = data.month;
      session.data.game_env.month = data.month;
      session.month = data.month;
    }
    
    if (data.startyear !== undefined) {
      if (!session.data) session.data = {};
      if (!session.data.game_env) session.data.game_env = {};
      session.data.game_env.startyear = data.startyear;
      session.data.game_env.startYear = data.startyear;
      session.startyear = data.startyear;
    }
    
    if (data.turnterm !== undefined) {
      if (!session.data) session.data = {};
      if (!session.data.game_env) session.data.game_env = {};
      session.data.turnterm = data.turnterm;
      session.data.game_env.turnterm = data.turnterm;
      session.turnterm = data.turnterm;
    }
    
    if (data.isunited !== undefined) {
      if (!session.data) session.data = {};
      if (!session.data.game_env) session.data.game_env = {};
      session.data.isunited = data.isunited;
      session.data.game_env.isunited = data.isunited;
      session.isunited = data.isunited;
    }
    
    if (data.scenario_name !== undefined) {
      session.scenario_name = data.scenario_name;
      if (!session.data) session.data = {};
      if (!session.data.game_env) session.data.game_env = {};
      session.data.game_env.scenario = data.scenario_name;
    }
    
    // Mongoose nested object 변경 감지
    session.markModified('data');
    session.markModified('data.game_env');
    session.updated_at = new Date();
    
    await session.save();
    
    // Redis 캐시 무효화
    try {
      const { cacheManager } = await import('../cache/CacheManager');
      await cacheManager.delete(`session:state:${sessionId}`);
      await cacheManager.delete(`session:byId:${sessionId}`);
      console.log(`[AdminSession] Cache invalidated for ${sessionId}`);
    } catch (error) {
      console.warn(`[AdminSession] Failed to invalidate cache:`, error);
    }
    
    res.json({
      success: true,
      message: '세션 데이터가 업데이트되었습니다',
      session: {
        sessionId: session.session_id,
        year: session.data?.year,
        month: session.data?.month,
        startyear: session.data?.game_env?.startyear,
        scenario: session.scenario_name,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/session/init-default:
 *   post:
 *     summary: 기본 세션 생성 (초기 설치용)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/init-default', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const defaultSessions = [
      {
        session_id: 'sangokushi_default',
        data: {
          scenario: '체섭 - 메인 서버',
          turnterm: 60,
          isunited: 2,
          startyear: 200,
          year: 200,
          month: 1,
          joinMode: 'full',
          npcMode: 0,
          extendedGeneral: 1,
          isFiction: 0,
          scenarioText: '메인 서버입니다. 천하통일에 도전하세요!',
          isLocked: false,
          turntime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          lastExecuted: new Date().toISOString(),
        },
      },
      {
        session_id: 'kwe_server',
        data: {
          scenario: '퀘섭 - 느린 속도',
          turnterm: 120,
          isunited: 2,
          startyear: 200,
          year: 200,
          month: 1,
          joinMode: 'full',
          npcMode: 0,
          extendedGeneral: 1,
          isFiction: 0,
          scenarioText: '느린 속도로 운영되는 서버입니다.',
          isLocked: false,
          turntime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          lastExecuted: new Date().toISOString(),
        },
      },
      {
        session_id: 'twe_server',
        data: {
          scenario: '퉤섭 - 빠른 속도',
          turnterm: 30,
          isunited: 2,
          startyear: 200,
          year: 200,
          month: 1,
          joinMode: 'full',
          npcMode: 0,
          extendedGeneral: 1,
          isFiction: 0,
          scenarioText: '빠른 속도로 운영되는 서버입니다.',
          isLocked: false,
          turntime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          lastExecuted: new Date().toISOString(),
        },
      },
      {
        session_id: 'test_server',
        data: {
          scenario: '테스트 서버',
          turnterm: 5,
          isunited: 2,
          startyear: 200,
          year: 200,
          month: 1,
          joinMode: 'full',
          npcMode: 0,
          extendedGeneral: 1,
          isFiction: 1,
          scenarioText: '개발/테스트용 서버입니다.',
          isLocked: false,
          turntime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          lastExecuted: new Date().toISOString(),
        },
      },
    ];
    
    const created: string[] = [];
    const skipped: string[] = [];
    
    for (const sessionData of defaultSessions) {
      const existing = await Session.findOne({ session_id: sessionData.session_id });
      if (existing) {
        skipped.push(sessionData.session_id);
        continue;
      }
      
      await Session.create({
        ...sessionData,
        created_at: new Date(),
        updated_at: new Date(),
      });
      created.push(sessionData.session_id);
    }
    
    res.json({
      success: true,
      message: '기본 세션 생성 완료',
      created,
      skipped,
      total: created.length + skipped.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

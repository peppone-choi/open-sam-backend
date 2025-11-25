// @ts-nocheck - Type issues need investigation
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { General } from '../models/general.model';
import { User } from '../models/user.model';
import { Session } from '../models/session.model';
import { SessionStateService } from '../services/sessionState.service';
import { FileWatcherService } from '../services/file-watcher.service';
import { ScenarioResetService } from '../services/admin/scenario-reset.service';
import { syncSessionStatus, type SessionStatus } from '../utils/session-status';
import { cityRepository } from '../repositories/city.repository';
import { nationRepository } from '../repositories/nation.repository';
import { AdminEconomyService } from '../services/admin/AdminEconomy.service';
import { AdminErrorLogService } from '../services/admin/AdminErrorLog.service';
import { ApiError } from '../errors/ApiError';
import Redis from 'ioredis';
import { redisHealthMonitor } from '../services/monitoring/RedisHealthMonitor';
import { invalidateCache } from '../common/cache/model-cache.helper';
import { 
  validate, 
  adminGeneralSchema, 
  adminPenaltySchema,
  userIdSchema,
  paginationSchema,
  preventMongoInjection,
  safeParseInt
} from '../middleware/validation.middleware';

const router = Router();

// Redis 클라이언트 (락 해제용)
let adminRedisClient: Redis | null = null;
function getAdminRedisClient(): Redis {
  if (!adminRedisClient) {
    const url = process.env.REDIS_URL;
    if (url) {
      adminRedisClient = new Redis(url);
    } else {
      adminRedisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
      });
    }
  }
  return adminRedisClient;
}

/**
 * 관리자 작업 전 락 강제 해제 및 전체 캐시 무효화
 */
async function forceUnlockAndClearCache(sessionId: string) {
  const redis = getAdminRedisClient();
  const lockKey = `execute_engine_lock:${sessionId}`;
  
  // 1. 락 강제 해제
  const lockExists = await redis.get(lockKey);
  if (lockExists) {
    await redis.del(lockKey);
    console.log(`[Admin] 🔓 강제 락 해제: ${lockKey}`);
  }
  
  // 2. 전체 세션 캐시 무효화
  try {
    await Promise.all([
      invalidateCache('session', sessionId),
      invalidateCache('general', sessionId),
      invalidateCache('city', sessionId),
      invalidateCache('nation', sessionId)
    ]);
    console.log(`[Admin] 🗑️ 전체 캐시 무효화 완료: ${sessionId}`);
  } catch (error) {
    console.error('[Admin] 캐시 무효화 실패:', error);
  }
  
  // 3. SessionStateService 캐시 무효화
  await SessionStateService.invalidateCache(sessionId);
}

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
 * /api/admin/monitoring/redis:
 *   get:
 *     summary: Redis 상태 모니터링 스냅샷
 *     tags: [Admin]
 */
router.get('/monitoring/redis', (_req, res) => {
  const snapshot = redisHealthMonitor.snapshot();
  res.json({
    result: true,
    monitor: snapshot,
  });
});

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
    const users = await User.find({})
      .select('username name grade picture createdAt -password')
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
router.post('/update-user', preventMongoInjection('body'), validate(userIdSchema), async (req, res) => {
  try {
    const { userID, action, data = {} } = req.body;
    
    if (!userID) {
      return res.status(400).json({
        result: false,
        reason: '사용자 ID가 필요합니다'
      });
    }
    
    const user = await User.findById(userID).select('-password');
    if (!user) {
      return res.status(404).json({
        result: false,
        reason: '사용자를 찾을 수 없습니다'
      });
    }
    
    let updated = false;
    if (action === 'grade' && data.grade !== undefined) {
      user.grade = data.grade;
      updated = true;
    } else if (action === 'name' && data.name) {
      user.name = data.name;
      updated = true;
    } else if (action === 'acl' && data.acl !== undefined) {
      user.acl = data.acl;
      updated = true;
    } else if (action === 'block' && data.block !== undefined) {
      user.block = data.block;
      updated = true;
    }

    if (!updated) {
      return res.status(400).json({
        result: false,
        reason: '지원되지 않는 수정이거나 변경할 값이 없습니다'
      });
    }

    await user.save();
    
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
 * /api/admin/error-log:
 *   post:
 *     summary: 에러 로그 조회
 *     tags: [Admin]
 */
router.post('/error-log', validate(paginationSchema), async (req, res) => {
  try {
    const from = Number(req.body.from) || 0;
    const limit = Math.min(Number(req.body.limit) || 100, 500);
    const result = await AdminErrorLogService.getLogs({ offset: from, limit });

    res.json({
      result: true,
      total: result.total,
      errorLogs: result.errorLogs
    });
  } catch (error: any) {
    const status = error instanceof ApiError ? error.status : 500;
    res.status(status).json({
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
    
    const session = await Session.findOne({ session_id: sessionId }).lean();
    const sessionData = session?.data || {};
    const gameEnv = sessionData.game_env || {};
    
    // isunited는 두 위치 중 하나에서 가져옴 (레거시 호환성)
    const isunited = gameEnv.isunited !== undefined ? gameEnv.isunited : (sessionData.isunited !== undefined ? sessionData.isunited : 0);
    
    console.log('[Admin] Get game-info:', {
      sessionId,
      hasGameEnv: !!sessionData.game_env,
      gameEnvIsunited: gameEnv.isunited,
      dataIsunited: sessionData.isunited,
      finalIsunited: isunited,
      gameEnvKeys: Object.keys(gameEnv)
    });
    
    // 세션 상태 (status 우선, 없으면 isunited로 추론)
    const { getCurrentStatus } = await import('../utils/session-status');
    const currentStatus = getCurrentStatus(session);
    
    // turnDate를 호출하여 현재 년/월 계산 (GetMap과 동일한 방식)
    const { ExecuteEngineService } = await import('../services/global/ExecuteEngine.service');
    const turntime = sessionData.turntime ? new Date(sessionData.turntime) : new Date();
    const gameEnvCopy = { ...sessionData };
    const turnInfo = ExecuteEngineService.turnDate(turntime, gameEnvCopy);
    
    const gameInfo = {
      serverName: session?.name || '',
      scenario: session?.scenario_name || gameEnv.scenario || '',
      msg: sessionData.noticeMsg || '',
      turnterm: sessionData.turnterm || 0,
      turntime: sessionData.turntime || null,
      starttime: gameEnv.starttime || null,
      year: turnInfo.year,
      month: turnInfo.month,
      startyear: gameEnv.startyear || 220,
      maxgeneral: gameEnv.maxgeneral || 300,
      maxnation: gameEnv.maxnation || 12,
      isunited: isunited,
      status: currentStatus, // 추가!
      allowNpcPossess: gameEnv.allow_npc_possess || false,
    };
    
    console.log('[Admin] Returning isunited:', gameInfo.isunited);
    
    res.json({
      result: true,
      gameInfo
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
    const sessionId = req.query.session_id || req.body.session_id || data?.session_id || 'sangokushi_default';
    
    const session = await Session.findOne({ session_id: sessionId });
    if (!session) {
      return res.status(404).json({
        result: false,
        reason: '세션을 찾을 수 없습니다'
      });
    }
    
    // 게임 정보 업데이트
    session.data = session.data || {};
    if (!session.data.game_env) session.data.game_env = {};
    
    if (action === 'serverName') {
      session.name = data.serverName || '';
      session.data.game_env.serverName = data.serverName || '';
      session.markModified('data.game_env');
    } else if (action === 'scenario') {
      session.data.game_env.scenario = data.scenario || '';
      session.markModified('data.game_env');
    } else if (action === 'msg') {
      // AdminGameSettings 서비스를 사용하여 관리자 메시지 설정
      const { AdminGameSettingsService: AdminGameSettings } = await import('../services/admin/AdminGameSettings.service');
      const result = await AdminGameSettings.setAdminMessage(sessionId, data.msg || '');
      
      if (!result.success) {
        return res.status(400).json({
          result: false,
          reason: result.message
        });
      }
      
      return res.json({
        result: true,
        message: result.message
      });
    } else if (action === 'log') {
      // AdminGameSettings 서비스를 사용하여 전역 로그 추가
      const { AdminGameSettingsService: AdminGameSettings } = await import('../services/admin/AdminGameSettings.service');
      const result = await AdminGameSettings.addGlobalLog(sessionId, data.log || '', req.user);
      
      if (!result.success) {
        return res.status(400).json({
          result: false,
          reason: result.message
        });
      }
      
      return res.json({
        result: true,
        message: result.message
      });
    } else if (action === 'starttime') {
      // AdminGameSettings 서비스를 사용하여 starttime 설정
      const { AdminGameSettingsService: AdminGameSettings } = await import('../services/admin/AdminGameSettings.service');
      const result = await AdminGameSettings.setStartTime(sessionId, data.starttime);
      
      if (!result.success) {
        return res.status(400).json({
          result: false,
          reason: result.message
        });
      }
      
      return res.json({
        result: true,
        message: result.message
      });
    } else if (action === 'maxgeneral') {
      // AdminGameSettings 서비스를 사용하여 maxgeneral 설정
      const { AdminGameSettingsService: AdminGameSettings } = await import('../services/admin/AdminGameSettings.service');
      const result = await AdminGameSettings.setMaxGeneral(sessionId, parseInt(data.maxgeneral) || 300);
      
      if (!result.success) {
        return res.status(400).json({
          result: false,
          reason: result.message
        });
      }
      
      return res.json({
        result: true,
        message: result.message
      });
    } else if (action === 'maxnation') {
      // AdminGameSettings 서비스를 사용하여 maxnation 설정
      const { AdminGameSettingsService: AdminGameSettings } = await import('../services/admin/AdminGameSettings.service');
      const result = await AdminGameSettings.setMaxNation(sessionId, parseInt(data.maxnation) || 12);
      
      if (!result.success) {
        return res.status(400).json({
          result: false,
          reason: result.message
        });
      }
      
      return res.json({
        result: true,
        message: result.message
      });
    } else if (action === 'startyear') {
      // AdminGameSettings 서비스를 사용하여 startyear 설정
      const { AdminGameSettingsService: AdminGameSettings } = await import('../services/admin/AdminGameSettings.service');
      const result = await AdminGameSettings.setStartYear(sessionId, parseInt(data.startyear) || 220);
      
      if (!result.success) {
        return res.status(400).json({
          result: false,
          reason: result.message
        });
      }
      
      return res.json({
        result: true,
        message: result.message
      });
    } else if (action === 'allowNpcPossess') {
      // 오리지널 캐릭터 플레이 허용 설정
      session.data.game_env.allow_npc_possess = data.allowNpcPossess;
      session.markModified('data.game_env');
      await session.save();
      
      return res.json({
        result: true,
        message: '오리지널 캐릭터 플레이 설정이 변경되었습니다'
      });
    } else if (action === 'turnterm') {
      // AdminGameSettings 서비스를 사용하여 turnterm 변경 (장수 턴타임 재계산 포함)
      const { AdminGameSettingsService: AdminGameSettings } = await import('../services/admin/AdminGameSettings.service');
      const result = await AdminGameSettings.setTurnTerm(sessionId, parseInt(data.turnterm) || 60);
      
      if (!result.success) {
        return res.status(400).json({
          result: false,
          reason: result.message
        });
      }
      
      // 이미 setTurnTerm에서 session.save()를 했으므로 여기서는 다시 저장하지 않음
      return res.json({
        result: true,
        message: result.message
      });
    } else if (action === 'year') {
      // 락 해제 및 캐시 무효화
      await forceUnlockAndClearCache(sessionId);
      
      session.data.year = data.year || session.data.year || 184;
      session.data.game_env.year = session.data.year;
      session.markModified('data');
      session.markModified('data.game_env');
    } else if (action === 'month') {
      // 락 해제 및 캐시 무효화
      await forceUnlockAndClearCache(sessionId);
      
      session.data.month = data.month || session.data.month || 1;
      session.data.game_env.month = session.data.month;
      session.markModified('data');
      session.markModified('data.game_env');
    } else if (action === 'status') {
      // status 변경: preparing, running, paused, finished, united
      const newStatus = data.status as SessionStatus;
      const validStatuses: SessionStatus[] = ['preparing', 'running', 'paused', 'finished', 'united'];
      
      if (!validStatuses.includes(newStatus)) {
        return res.status(400).json({
          result: false,
          reason: `유효하지 않은 상태입니다. 가능한 값: ${validStatuses.join(', ')}`
        });
      }

      // 락 해제 및 캐시 무효화
      await forceUnlockAndClearCache(sessionId);

      // 헬퍼 함수로 status와 isunited 동기화
      syncSessionStatus(session, newStatus);
      await session.save();
      
      // SessionStateService 캐시 무효화
      await SessionStateService.invalidateCache(sessionId);
      
      console.log('[Admin] Session status changed:', {
        sessionId,
        newStatus,
        isunited: session.data.game_env.isunited
      });
      
      // preparing → running으로 변경 시 즉시 턴 처리 시작
      if (newStatus === 'running') {
        console.log('[Admin] 🚀 Status changed to running, triggering immediate turn execution...');
        
        // ExecuteEngine 동적 임포트하여 즉시 실행
        const { ExecuteEngineService } = await import('../services/global/ExecuteEngine.service');
        
        // 비동기로 턴 처리 시작 (응답은 바로 반환)
        ExecuteEngineService.execute({ session_id: sessionId })
          .then(result => {
            console.log('[Admin] ✅ Initial turn execution completed:', result);
          })
          .catch(err => {
            console.error('[Admin] ❌ Initial turn execution failed:', err);
          });
      }
      
      return res.json({
        result: true,
        reason: `서버 상태가 ${newStatus}로 변경되었습니다${newStatus === 'running' ? ' (턴 처리 즉시 시작됨)' : ''}`,
        status: newStatus,
        isunited: session.data.game_env.isunited
      });
    } else if (action === 'lock') {
      const locked = data.locked !== undefined ? data.locked : false;
      await SessionStateService.updateSessionState(sessionId, {
        isLocked: locked,
        status: locked ? 'paused' : 'running'
      });
      
      // 잠금 해제(unlock) 시 즉시 턴 처리 시작
      if (!locked) {
        console.log('[Admin] 🚀 Session unlocked, triggering immediate turn execution...');
        
        const { ExecuteEngineService } = await import('../services/global/ExecuteEngine.service');
        
        ExecuteEngineService.execute({ session_id: sessionId })
          .then(result => {
            console.log('[Admin] ✅ Turn execution after unlock completed:', result);
          })
          .catch(err => {
            console.error('[Admin] ❌ Turn execution after unlock failed:', err);
          });
      }
    } else if (action === 'block_create') {
      session.data.block_general_create = data.block_create !== undefined ? data.block_create : 0;
      session.markModified('data');
    } else if (action === 'fix_turntime') {
      // 락 해제 및 캐시 무효화
      await forceUnlockAndClearCache(sessionId);
      
      // turntime 수정 (분 단위)
      const minutes = parseInt(data.minutes || '60', 10);
      const now = new Date();
      const newTurntime = new Date(now.getTime() + minutes * 60 * 1000);
      session.data.turntime = newTurntime.toISOString();
      session.data.game_env.turntime = newTurntime.toISOString();
      session.markModified('data');
      session.markModified('data.game_env');
    } else if (action === 'fix_age') {
      // 락 해제 및 캐시 무효화
      await forceUnlockAndClearCache(sessionId);
      
      // 비정상적으로 높은 나이를 수정
      const maxAge = data?.maxAge || 200;
      const fixedAge = data?.fixedAge || 30; // 기본값: 30살
      
      const result = await General.updateMany(
        {
          session_id: sessionId,
          'data.age': { $gt: maxAge }
        },
        {
          $set: { 
            'data.age': fixedAge,
            'data.age_month': 0
          }
        }
      );
      
      return res.json({
        result: true,
        reason: `${result.modifiedCount}명의 장수 나이를 ${fixedAge}살로 수정했습니다`,
        modifiedCount: result.modifiedCount
      });
    } else if (action === 'serverStatus') {
      // 서버 열기/닫기
      const isunited = parseInt(data.isunited);
      console.log('[Admin] Change server status:', {
        sessionId,
        isunited,
        dataIsunited: data.isunited,
        beforeGameEnv: session.data.game_env.isunited,
        beforeData: session.data.isunited
      });
      
      // 락 해제 및 캐시 무효화
      await forceUnlockAndClearCache(sessionId);
      
      // 두 필드 모두 업데이트 (레거시 호환성)
      session.data.game_env.isunited = isunited;
      session.data.isunited = isunited;
      session.markModified('data.game_env');
      session.markModified('data');
      await session.save();
      
      console.log('[Admin] Server status changed:', {
        sessionId,
        afterGameEnv: session.data.game_env.isunited,
        afterData: session.data.isunited
      });
      
      // isunited = 0 (오픈)으로 변경 시 즉시 턴 처리 시작
      if (isunited === 0) {
        console.log('[Admin] 🚀 Server opened (isunited=0), triggering immediate turn execution...');
        
        const { ExecuteEngineService } = await import('../services/global/ExecuteEngine.service');
        
        ExecuteEngineService.execute({ session_id: sessionId })
          .then(result => {
            console.log('[Admin] ✅ Turn execution after server open completed:', result);
          })
          .catch(err => {
            console.error('[Admin] ❌ Turn execution after server open failed:', err);
          });
      }
      
      return res.json({
        result: true,
        reason: `서버 상태가 변경되었습니다 (isunited=${isunited})${isunited === 0 ? ' (턴 처리 즉시 시작됨)' : ''}`
      });
    } else if (action === 'resetScenario') {
      // 시나리오 초기화 - 모든 장수/국가 데이터 삭제 후 시나리오 로드
      let scenarioId = data.scenarioId;
      if (!scenarioId) {
        return res.status(400).json({
          result: false,
          reason: '시나리오 ID가 필요합니다'
        });
      }
      
      // 레거시 시나리오 ID를 CQRS 시나리오 ID로 매핑
      const legacyToNewMap: Record<string, string> = {
        // 삼국지 시나리오: 실제 파일 구조에 맞게 scenario_XXXX.json으로 매핑
        // ex) 1010(황건적의 난) → sangokushi/scenario-1010 → ScenarioResetService에서 scenario_1010.json 사용
        '1010': 'sangokushi/scenario-1010',
        '1020': 'sangokushi/scenario-1020',
        '1021': 'sangokushi/scenario-1021',
        '1030': 'sangokushi/scenario-1030',
        '1031': 'sangokushi/scenario-1031',
        '1040': 'sangokushi/scenario-1040',
        '1041': 'sangokushi/scenario-1041',
        '1050': 'sangokushi/scenario-1050',
        '1060': 'sangokushi/scenario-1060',
        '1070': 'sangokushi/scenario-1070',
        '1080': 'sangokushi/scenario-1080',
        '1090': 'sangokushi/scenario-1090',
        '1100': 'sangokushi/scenario-1100',
        '1110': 'sangokushi/scenario-1110',
        '1120': 'sangokushi/scenario-1120',
      };
      
      // 레거시 ID면 변환
      if (legacyToNewMap[scenarioId]) {
        console.log(`[Admin] Converting legacy scenario ID ${scenarioId} -> ${legacyToNewMap[scenarioId]}`);
        scenarioId = legacyToNewMap[scenarioId];
      }
      
      try {
        // turnterm 파라미터 전달 (프론트엔드에서 보낸 값 또는 세션의 현재 값 사용)
        const turnterm = data.turnterm || session.data?.game_env?.turnterm || session.turnterm;
        const options = turnterm ? { turnterm } : undefined;
        
        console.log(`[Admin] Resetting scenario ${scenarioId} with turnterm: ${turnterm || 'default'}`);
        
        await ScenarioResetService.resetScenario(sessionId, scenarioId, options);
        
        return res.json({
          result: true,
          reason: `시나리오 초기화가 완료되었습니다 (scenarioId=${scenarioId}, turnterm=${turnterm || 'default'})`
        });
      } catch (err: any) {
        console.error('[Admin] Scenario reset failed:', err);
        return res.status(500).json({
          result: false,
          reason: `시나리오 초기화 실패: ${err.message}`
        });
      }
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
      const [generalCount, nations, cities, userCount] = await Promise.all([
        General.countDocuments({ session_id: sessionId }),
        nationRepository.findBySession(sessionId),
        cityRepository.findBySession(sessionId),
        User.countDocuments({})
      ]);
      
      infoList = [
        { name: '총 장수', value: generalCount },
        { name: '총 국가', value: (nations || []).length },
        { name: '총 도시', value: (cities || []).length },
        { name: '총 사용자', value: userCount }
      ];
    } else if (type === 1) {
      // 장수 정보
      const generals = await General.find({ session_id: sessionId })
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
      const nations = (await nationRepository.findBySession(sessionId)) || [];
      
      infoList = nations.map((n: any) => ({
        nation: n.data?.nation || n.nation,
        name: n.name || n.data?.name || '',
        level: n.data?.level || n.level || 0,
        gennum: n.data?.gennum || n.gennum || 0
      }));
    } else if (type === 3) {
      const cities = (await cityRepository.findBySession(sessionId)) || [];
      
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
router.post('/general', preventMongoInjection('body'), async (req, res) => {
  try {
    const { generalID } = req.body;
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    
    let query: any = { session_id: sessionId };
    if (generalID) {
      // Safe integer validation
      const safeGeneralID = safeParseInt(generalID, 'generalID');
      query['data.no'] = safeGeneralID;
    }
    
    const generals = await General.find(query)
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
    
    const users = await User.find(query)
      .select('-password')
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
    
    const session = await Session.findOne({ session_id: sessionId }).lean();
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
    
    const session = await Session.findOne({ session_id: sessionId });
    if (!session) {
      return res.status(404).json({
        result: false,
        reason: '세션을 찾을 수 없습니다'
      });
    }
    
    session.data = session.data || {};
    
    if (action === 'turnterm') {
      // AdminGameSettings 서비스를 사용하여 turnterm 변경 (장수 턴타임 재계산 포함)
      const { AdminGameSettingsService: AdminGameSettings } = await import('../services/admin/AdminGameSettings.service');
      const result = await AdminGameSettings.setTurnTerm(sessionId, parseInt(data.turnterm) || 60);
      
      if (!result.success) {
        return res.status(400).json({
          result: false,
          reason: result.message
        });
      }
      
      return res.json({
        result: true,
        reason: result.message
      });
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
    const session = await Session.findOne({ session_id: sessionId }).lean();
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
    
    const generals = await General.find({
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
    const playerGenerals = await General.find({
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

/**
 * @swagger
 * /api/admin/sync-cities:
 *   post:
 *     summary: JSON 파일 변경 시 도시 데이터 수동 동기화
 *     tags: [Admin]
 */
router.post('/sync-cities', async (req, res) => {
  try {
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    
    await FileWatcherService.syncCities(sessionId);
    
    res.json({
      result: true,
      reason: '도시 데이터 동기화가 완료되었습니다'
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
 * /api/admin/system-status:
 *   get:
 *     summary: 시스템 상태 조회 (turntime, plock 등)
 *     tags: [Admin]
 */
router.get('/system-status', async (req, res) => {
  try {
    const sessionId = req.query.session_id || 'sangokushi_default';
    
    const session = await Session.findOne({ session_id: sessionId }).lean();
    if (!session) {
      return res.status(404).json({
        result: false,
        reason: '세션을 찾을 수 없습니다'
      });
    }
    
    const { Plock } = await import('../models/plock.model');
    const plock = await Plock.findOne({ session_id: sessionId }).lean();
    
    const sessionData = session.data || {};
    const plockData = plock?.data || {};
    
    res.json({
      result: true,
      status: {
        turntime: sessionData.turntime || null,
        starttime: sessionData.starttime || null,
        tnmt_time: sessionData.tnmt_time || null,
        plock: plockData.plock || 0,
        turnterm: sessionData.turnterm || 0
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
 * /api/admin/adjust-time:
 *   post:
 *     summary: 시간 조정 (턴 시간/토너먼트 시간 앞당기기/지연)
 *     tags: [Admin]
 */
router.post('/adjust-time', async (req, res) => {
  try {
    const { type, minutes } = req.body;
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    
    if (!type || minutes === undefined) {
      return res.status(400).json({
        result: false,
        reason: 'type과 minutes 파라미터가 필요합니다'
      });
    }
    
    const minutesNum = parseInt(minutes, 10);
    if (isNaN(minutesNum)) {
      return res.status(400).json({
        result: false,
        reason: 'minutes는 숫자여야 합니다'
      });
    }
    
    const session = await Session.findOne({ session_id: sessionId });
    if (!session) {
      return res.status(404).json({
        result: false,
        reason: '세션을 찾을 수 없습니다'
      });
    }
    
    session.data = session.data || {};
    const adjustMs = minutesNum * 60 * 1000;
    
    // ⚠️ CRITICAL FIX: 시간 조정 시 유효성 검증
    const now = new Date();
    const tenYearsAgo = now.getTime() - 10 * 365 * 24 * 60 * 60 * 1000;
    const oneYearFuture = now.getTime() + 365 * 24 * 60 * 60 * 1000;
    
    if (type === 'turn_advance') {
      // 턴 시간 앞당김
      const currentTurntime = session.data.turntime ? new Date(session.data.turntime) : new Date();
      const newTurntimeMs = currentTurntime.getTime() - adjustMs;
      
      // 유효성 검증: 10년 이전으로 가지 않도록
      if (newTurntimeMs < tenYearsAgo) {
        return res.status(400).json({
          result: false,
          reason: `Advancing turn by ${minutesNum} minutes would set time too far in the past`
        });
      }
      
      session.data.turntime = new Date(newTurntimeMs).toISOString();
      
      const currentStarttime = session.data.starttime ? new Date(session.data.starttime) : new Date();
      const newStarttimeMs = currentStarttime.getTime() - adjustMs;
      
      // starttime도 검증
      if (newStarttimeMs < tenYearsAgo) {
        return res.status(400).json({
          result: false,
          reason: `Advancing turn would set starttime too far in the past`
        });
      }
      
      session.data.starttime = new Date(newStarttimeMs).toISOString();
      
      // General 테이블의 turntime도 조정
      await General.updateMany(
        { session_id: sessionId },
        { $set: { 'data.turntime': session.data.turntime } }
      );
      
      // NgAuction의 close_date도 조정
      const { NgAuction } = await import('../models');
      await NgAuction.updateMany(
        { session_id: sessionId },
        { $inc: { 'data.close_date': -adjustMs } }
      );
      
    } else if (type === 'turn_delay') {
      // 턴 시간 지연
      const currentTurntime = session.data.turntime ? new Date(session.data.turntime) : new Date();
      const newTurntimeMs = currentTurntime.getTime() + adjustMs;
      
      // 유효성 검증: 1년 이후로 가지 않도록
      if (newTurntimeMs > oneYearFuture) {
        return res.status(400).json({
          result: false,
          reason: `Delaying turn by ${minutesNum} minutes would set time too far in the future`
        });
      }
      
      session.data.turntime = new Date(newTurntimeMs).toISOString();
      
      const currentStarttime = session.data.starttime ? new Date(session.data.starttime) : new Date();
      const newStarttimeMs = currentStarttime.getTime() + adjustMs;
      
      // starttime도 검증
      if (newStarttimeMs > oneYearFuture) {
        return res.status(400).json({
          result: false,
          reason: `Delaying turn would set starttime too far in the future`
        });
      }
      
      session.data.starttime = new Date(newStarttimeMs).toISOString();
      
      await General.updateMany(
        { session_id: sessionId },
        { $set: { 'data.turntime': session.data.turntime } }
      );
      
      const { NgAuction } = await import('../models');
      await NgAuction.updateMany(
        { session_id: sessionId },
        { $inc: { 'data.close_date': adjustMs } }
      );
      
    } else if (type === 'tournament_advance') {
      // 토너먼트 시간 앞당김
      const currentTnmtTime = session.data.tnmt_time ? new Date(session.data.tnmt_time) : new Date();
      session.data.tnmt_time = new Date(currentTnmtTime.getTime() - adjustMs).toISOString();
      
    } else if (type === 'tournament_delay') {
      // 토너먼트 시간 지연
      const currentTnmtTime = session.data.tnmt_time ? new Date(session.data.tnmt_time) : new Date();
      session.data.tnmt_time = new Date(currentTnmtTime.getTime() + adjustMs).toISOString();
      
    } else {
      return res.status(400).json({
        result: false,
        reason: '잘못된 type입니다'
      });
    }
    
    await session.save();
    
    res.json({
      result: true,
      reason: `${type}: ${minutesNum}분 조정 완료`
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
 * /api/admin/toggle-lock:
 *   post:
 *     summary: 게임 락 제어 (동결/가동)
 *     tags: [Admin]
 */
router.post('/toggle-lock', async (req, res) => {
  try {
    const { lock } = req.body;
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    
    if (lock === undefined) {
      return res.status(400).json({
        result: false,
        reason: 'lock 파라미터가 필요합니다'
      });
    }
    
    const { Plock } = await import('../models/plock.model');
    
    let plock = await Plock.findOne({ session_id: sessionId });
    if (!plock) {
      plock = new Plock({
        session_id: sessionId,
        data: {}
      });
    }
    
    plock.data = plock.data || {};
    plock.data.plock = lock ? 1 : 0;
    
    await plock.save();
    
    res.json({
      result: true,
      reason: lock ? '게임이 동결되었습니다' : '게임이 가동되었습니다'
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
 * /api/admin/pay-salary:
 *   post:
 *     summary: 봉급 즉시 지급 (금/쌀)
 *     tags: [Admin]
 */
router.post('/pay-salary', async (req, res) => {
  try {
    const type = String(req.body.type || '').toLowerCase();
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    
    if (!['gold', 'rice'].includes(type)) {
      return res.status(400).json({
        result: false,
        reason: 'type은 "gold" 또는 "rice"여야 합니다'
      });
    }

    const result = await AdminEconomyService.paySalary(sessionId, type as 'gold' | 'rice');
    res.json(result);
  } catch (error: any) {
    const status = error instanceof ApiError ? error.status : 500;
    res.status(status).json({
      result: false,
      reason: error.message
    });
  }
});

/**
 * @swagger
 * /api/admin/test/create-npcs:
 *   post:
 *     summary: 테스트용 NPC 생성
 *     tags: [Admin, Test]
 *     security:
 *       - bearerAuth: []
 */
router.post('/test/create-npcs', async (req, res) => {
  try {
    const { CreateTestNPCsService } = await import('../services/test/CreateTestNPCs.service');
    const sessionId = req.body.session_id || 'sangokushi_default';
    const count = req.body.count || 10;
    const options = {
      cityId: req.body.cityId,
      nationId: req.body.nationId || 0,
      autoRaiseArmy: req.body.autoRaiseArmy || false,
      minStats: req.body.minStats || 50,
      maxStats: req.body.maxStats || 100
    };

    const result = await CreateTestNPCsService.execute(sessionId, count, options);
    
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
 * /api/admin/test/delete-npcs:
 *   post:
 *     summary: 모든 NPC 삭제
 *     tags: [Admin, Test]
 *     security:
 *       - bearerAuth: []
 */
router.post('/test/delete-npcs', async (req, res) => {
  try {
    const { CreateTestNPCsService } = await import('../services/test/CreateTestNPCs.service');
    const sessionId = req.body.session_id || 'sangokushi_default';

    const result = await CreateTestNPCsService.deleteAllNPCs(sessionId);
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      result: false,
      reason: error.message
    });
  }
});

// ============================================================
// Admin API - 새로운 구조화된 엔드포인트 (AdminService 사용)
// ============================================================

/**
 * @swagger
 * /api/admin/game/set-message:
 *   post:
 *     summary: 운영자 메시지 설정
 *     tags: [Admin - Game]
 */
router.post('/game/set-message', async (req, res) => {
  try {
    const { AdminGameSettingsService } = await import('../services/admin/AdminGameSettings.service');
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    const message = req.body.message || req.body.msg || '';
    
    const result = await AdminGameSettingsService.setAdminMessage(sessionId, message);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/admin/game/add-global-log:
 *   post:
 *     summary: 중원정세 추가
 *     tags: [Admin - Game]
 */
router.post('/game/add-global-log', async (req, res) => {
  try {
    const { AdminGameSettingsService } = await import('../services/admin/AdminGameSettings.service');
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    const logText = req.body.log || req.body.text || '';
    
    const result = await AdminGameSettingsService.addGlobalLog(sessionId, logText, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/admin/game/send-notice:
 *   post:
 *     summary: 전체 공지 전송
 *     tags: [Admin - Game]
 */
router.post('/game/send-notice', async (req, res) => {
  try {
    const { AdminGameSettingsService } = await import('../services/admin/AdminGameSettings.service');
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    const text = req.body.text || req.body.message || '';
    
    const result = await AdminGameSettingsService.sendNoticeToAll(sessionId, text);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/admin/game/set-turnterm:
 *   post:
 *     summary: 턴 기간 변경
 *     tags: [Admin - Game]
 */
router.post('/game/set-turnterm', async (req, res) => {
  try {
    const { AdminGameSettingsService } = await import('../services/admin/AdminGameSettings.service');
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    const turnTerm = parseInt(req.body.turnterm || req.body.turnTerm);
    
    const result = await AdminGameSettingsService.setTurnTerm(sessionId, turnTerm);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/admin/game/settings:
 *   get:
 *     summary: 게임 설정 조회
 *     tags: [Admin - Game]
 */
router.get('/game/settings', async (req, res) => {
  try {
    const { AdminGameSettingsService } = await import('../services/admin/AdminGameSettings.service');
    const sessionId = req.query.session_id || 'sangokushi_default';
    
    const result = await AdminGameSettingsService.getSettings(sessionId as string);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/admin/user/generals:
 *   get:
 *     summary: 장수 목록 조회
 *     tags: [Admin - User]
 */
router.get('/user/generals', async (req, res) => {
  try {
    const { AdminUserManagementService } = await import('../services/admin/AdminUserManagement.service');
    const sessionId = req.query.session_id || 'sangokushi_default';
    
    const result = await AdminUserManagementService.getGeneralList(sessionId as string);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/admin/user/set-block:
 *   post:
 *     summary: 장수 블럭 설정
 *     tags: [Admin - User]
 */
router.post('/user/set-block', preventMongoInjection('body'), validate(adminPenaltySchema), async (req, res) => {
  try {
    const { AdminUserManagementService } = await import('../services/admin/AdminUserManagement.service');
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    // Already validated by middleware
    const generalNo = req.body.generalNo;
    const penaltyLevel = req.body.penaltyLevel;
    
    const result = await AdminUserManagementService.setGeneralBlock(sessionId, generalNo, penaltyLevel);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/admin/user/force-death:
 *   post:
 *     summary: 장수 강제 사망
 *     tags: [Admin - User]
 */
router.post('/user/force-death', async (req, res) => {
  try {
    const { AdminUserManagementService } = await import('../services/admin/AdminUserManagement.service');
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    const generalNo = parseInt(req.body.generalNo || req.body.general_id);
    
    const result = await AdminUserManagementService.forceGeneralDeath(sessionId, generalNo);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/admin/user/grant-skill:
 *   post:
 *     summary: 병종 숙련도 부여
 *     tags: [Admin - User]
 */
router.post('/user/grant-skill', async (req, res) => {
  try {
    const { AdminUserManagementService } = await import('../services/admin/AdminUserManagement.service');
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    const generalNo = parseInt(req.body.generalNo || req.body.general_id);
    const crewType = parseInt(req.body.crewType);
    const amount = parseInt(req.body.amount || '10000');
    
    const result = await AdminUserManagementService.grantCrewSkill(sessionId, generalNo, crewType, amount);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/admin/user/send-message:
 *   post:
 *     summary: 개인 메시지 전달
 *     tags: [Admin - User]
 */
router.post('/user/send-message', async (req, res) => {
  try {
    const { AdminUserManagementService } = await import('../services/admin/AdminUserManagement.service');
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    const generalNo = parseInt(req.body.generalNo || req.body.general_id);
    const text = req.body.text || req.body.message || '';
    
    const result = await AdminUserManagementService.sendMessageToGeneral(sessionId, generalNo, text);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/admin/user/stats:
 *   get:
 *     summary: 장수 통계 조회
 *     tags: [Admin - User]
 */
router.get('/user/stats', async (req, res) => {
  try {
    const { AdminUserManagementService } = await import('../services/admin/AdminUserManagement.service');
    const sessionId = req.query.session_id || 'sangokushi_default';
    
    const result = await AdminUserManagementService.getGeneralStats(sessionId as string);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/admin/server/list:
 *   get:
 *     summary: 서버 목록 조회
 *     tags: [Admin - Server]
 */
router.get('/server/list', async (req, res) => {
  try {
    const { AdminServerManagementService } = await import('../services/admin/AdminServerManagement.service');
    
    const result = await AdminServerManagementService.getServerList();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/admin/server/status:
 *   get:
 *     summary: 서버 상태 조회
 *     tags: [Admin - Server]
 */
router.get('/server/status/:sessionId', async (req, res) => {
  try {
    const { AdminServerManagementService } = await import('../services/admin/AdminServerManagement.service');
    const sessionId = req.params.sessionId;
    
    const result = await AdminServerManagementService.getServerStatus(sessionId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/admin/nation/stats:
 *   get:
 *     summary: 국가 통계 조회
 *     tags: [Admin - Nation]
 */
router.get('/nation/stats', async (req, res) => {
  try {
    const { AdminNationStatsService } = await import('../services/admin/AdminNationStats.service');
    const sessionId = req.query.session_id || 'sangokushi_default';
    const sortType = parseInt(req.query.sort_type as string) || 0;
    
    const result = await AdminNationStatsService.getNationStats(sessionId as string, sortType);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/admin/nation/change-general:
 *   post:
 *     summary: 장수 국가 변경
 *     tags: [Admin - Nation]
 */
router.post('/nation/change-general', async (req, res) => {
  try {
    const { AdminNationStatsService } = await import('../services/admin/AdminNationStats.service');
    const sessionId = req.query.session_id || req.body.session_id || 'sangokushi_default';
    const generalNo = parseInt(req.body.generalNo || req.body.general_id);
    const nationId = parseInt(req.body.nationId || req.body.nation);
    
    const result = await AdminNationStatsService.changeGeneralNation(sessionId, generalNo, nationId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;


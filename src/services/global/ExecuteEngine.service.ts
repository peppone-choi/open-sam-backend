// @ts-nocheck - Type issues need investigation
import { sessionRepository } from '../../repositories/session.repository';
import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { cityRepository } from '../../repositories/city.repository';
import { generalTurnRepository } from '../../repositories/general-turn.repository';
import { nationTurnRepository } from '../../repositories/nation-turn.repository';
import { commandRepository } from '../../repositories/command.repository';
import { logger } from '../../common/logger';
import { Util } from '../../utils/Util';
import { kvStorageRepository } from '../../repositories/kvstorage.repository';
import Redis from 'ioredis';
import { GameEventEmitter } from '../gameEventEmitter';
import { invalidateCache } from '../../common/cache/model-cache.helper';
import { SessionStateService } from '../sessionState.service';
import { getCommand, getNationCommand } from '../../commands';
import { GeneralLog } from '../../models/general-log.model';

const MAX_TURN = 50;
const MAX_CHIEF_TURN = 12;
const LOCK_KEY = 'execute_engine_lock';
const LOCK_TTL = parseInt(process.env.EXECUTE_ENGINE_LOCK_TTL || '120', 10); // 기본 120초 (환경 변수로 조정 가능)
const LOCK_HEARTBEAT_INTERVAL = Math.max(5, Math.floor(LOCK_TTL / 3)); // TTL의 1/3 (최소 5초)

let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    const url = process.env.REDIS_URL;
    if (url) {
      redisClient = new Redis(url, {
        connectTimeout: 5000,
        enableOfflineQueue: true,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 200, 2000),
      });
    } else {
      redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        connectTimeout: 5000,
        enableOfflineQueue: true,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 200, 2000),
      });
    }
  }
  return redisClient;
}

/**
 * 턴 실행 엔진
 * PHP TurnExecutionHelper::executeAllCommand 완전 구현
 */
export class ExecuteEngineService {
  /**
   * 메인 실행 함수
   */
  static async execute(data: any, _user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const singleTurn = data.singleTurn === true || data.singleTurn === 1 || data.singleTurn === '1' || data.singleTurn === 'true';
    const redis = getRedisClient();
    const lockKey = `${LOCK_KEY}:${sessionId}`;

    let lockAcquired = false;
    let heartbeatInterval: NodeJS.Timeout | null = null;
    try {
      // TTL이 0 이하인 락은 만료된 것으로 간주하고 강제 삭제
      const currentLock = await redis.get(lockKey);
      if (currentLock) {
        const ttl = await redis.ttl(lockKey);
        if (ttl <= 0) {
          // 만료된 락 강제 삭제
          logger.warn('Removing expired lock', { lockKey, ttl });
          await redis.del(lockKey);
        } else {
          // 락이 너무 오래 유지되고 있으면 (TTL이 LOCK_TTL의 절반 이하) 강제 해제
          // 이는 heartbeat가 작동하지 않거나 프로세스가 죽은 경우를 대비
          if (ttl < LOCK_TTL / 2) {
            const ttlMinutes = Math.floor(ttl / 60);
            const ttlSeconds = ttl % 60;
            logger.warn('Lock exists but heartbeat may be dead, forcing release', { 
              lockKey, 
              ttl, 
              ttlMinutes, 
              ttlSeconds 
            });
            await redis.del(lockKey);
            // 계속 진행하여 락 획득 시도
          } else {
            // 락이 이미 존재하고 유효한 경우 (다른 인스턴스가 처리 중)
            // 하지만 TTL이 계속 유지되면 턴 처리가 너무 오래 걸리는 것일 수 있음
            const ttlMinutes = Math.floor(ttl / 60);
            const ttlSeconds = ttl % 60;
            logger.info('Lock already exists - Another instance is processing turns', { 
              lockKey, 
              ttl, 
              ttlMinutes, 
              ttlSeconds 
            });
            return {
              success: true,
              result: false,
              updated: false,
              locked: true,
              reason: 'Another instance is processing'
            };
          }
        }
      }

      const lock = await redis.set(lockKey, '1', 'EX', LOCK_TTL, 'NX');
      if (!lock) {
        const currentValue = await redis.get(lockKey);
        const ttl = await redis.ttl(lockKey);
        const ttlMinutes = Math.floor(ttl / 60);
        const ttlSeconds = ttl % 60;
        logger.warn('Failed to acquire lock', { 
          lockKey, 
          currentValue, 
          ttl, 
          ttlMinutes, 
          ttlSeconds 
        });
        return {
          success: true,
          result: false,
          updated: false,
          locked: true,
          reason: '다른 인스턴스가 이미 처리 중입니다.'
        };
      }
      lockAcquired = true;
      logger.info('Lock acquired', { lockKey, ttl: LOCK_TTL });
      
      // ⚠️ 중요: 캐시 대신 DB에서 직접 조회 (turnterm 등 설정 변경 즉시 반영)
      const { Session } = await import('../../models/session.model');
      const session = await Session.findOne({ session_id: sessionId });
      if (!session) {
        // 락을 해제하고 반환
        if (lockAcquired) {
          await redis.del(lockKey);
          lockAcquired = false;
          logger.warn('Lock released - session not found', { lockKey });
        }
        return {
          success: false,
          result: false,
          reason: '세션을 찾을 수 없습니다.',
          reqRefresh: true
        };
      }

      const sessionData = session.data as any || {};
      const now = new Date();

      // game_env 초기화
      if (!sessionData.game_env) {
        sessionData.game_env = {};
      }

      // 준비중/일시정지/종료 상태에서는 턴 실행 안 함
      const sessionStatus = session.status || 'running';
      if (sessionStatus !== 'running') {
        if (lockAcquired) {
          await redis.del(lockKey);
          lockAcquired = false;
          logger.info('Lock released - session not running', { lockKey, sessionStatus });
        }
        return {
          success: true,
          result: false,
          updated: false,
          reason: '서버가 실행 상태가 아니어서 턴 처리를 건너뜁니다.'
        };
      }

      // === 전술전투 처리 ===
      try {
        const { TacticalBattle, BattleStatus } = await import('../../models/tactical_battle.model');
        const { TacticalBattleAIService } = await import('../tactical/TacticalBattleAI.service');
        const { TacticalBattleEngineService } = await import('../tactical/TacticalBattleEngine.service');
        
        const now = new Date();
        
        // 1. 대기 시간 초과 전투 자동 시뮬레이션
        const waitingBattles = await TacticalBattle.find({
          session_id: sessionId,
          status: BattleStatus.WAITING,
        });
        
        for (const battle of waitingBattles) {
          const waitTime = (now.getTime() - battle.createdAt.getTime()) / 1000;
          
          if (waitTime >= battle.maxWaitTime) {
            logger.info('[ExecuteEngine] 전술전투 대기 시간 초과, 자동 시뮬레이션', {
              battleId: battle.battle_id,
              waitTime: Math.round(waitTime),
              maxWaitTime: battle.maxWaitTime,
            });
            
            // 자동 시뮬레이션 실행
            await TacticalBattleAIService.simulateBattle(battle.battle_id);
          }
        }
        
        // 2. 진행 중 전투의 턴 시간 초과 처리
        const processedTurns = await TacticalBattleEngineService.processTimeoutTurns(sessionId);
        if (processedTurns.length > 0) {
          logger.info('[ExecuteEngine] 전술전투 턴 시간 초과 처리', {
            count: processedTurns.length,
            battleIds: processedTurns,
          });
        }
      } catch (tacticalError: any) {
        logger.warn('[ExecuteEngine] 전술전투 처리 실패 (계속 진행)', {
          error: tacticalError?.message,
        });
      }

      // game_env의 데이터를 sessionData 최상위로 플랫화 (호환성)
      // 기존 코드는 sessionData.turnterm 직접 접근, 신규는 sessionData.game_env.turnterm
      if (sessionData.game_env.turnterm !== undefined) sessionData.turnterm = sessionData.game_env.turnterm;
      if (sessionData.game_env.turntime !== undefined) sessionData.turntime = sessionData.game_env.turntime;
      if (sessionData.game_env.starttime !== undefined) sessionData.starttime = sessionData.game_env.starttime;
      if (sessionData.game_env.year !== undefined) sessionData.year = sessionData.game_env.year;
      if (sessionData.game_env.month !== undefined) sessionData.month = sessionData.game_env.month;

      // turnterm 확인 - 우선순위: sessionData.turnterm > game_env.turnterm > session.turnterm > 기본값 60
      let turnterm = sessionData.turnterm || sessionData.game_env?.turnterm || session.turnterm;

      // turnterm이 없으면 기본값 설정 (테스트: 1분, 프로덕션: 60분)
      if (!turnterm) {
        const defaultTurnterm = process.env.NODE_ENV === 'production' ? 60 : 1;
        logger.warn('Missing turnterm, setting default', { defaultTurnterm });
        turnterm = defaultTurnterm;
        sessionData.turnterm = defaultTurnterm;
        sessionData.game_env.turnterm = defaultTurnterm;
        session.turnterm = defaultTurnterm;
        session.data = sessionData;
        session.markModified('data');
        await sessionRepository.saveDocument(session);
      }

      // turnterm 유효성 검사 (1분~1440분 사이만 허용)
      if (turnterm < 1 || turnterm > 1440) {
        const defaultTurnterm = process.env.NODE_ENV === 'production' ? 60 : 1;
        logger.warn('Invalid turnterm, resetting to default', { turnterm, defaultTurnterm });
        turnterm = defaultTurnterm;
        sessionData.turnterm = defaultTurnterm;
        sessionData.game_env.turnterm = defaultTurnterm;
        session.turnterm = defaultTurnterm;
        session.data = sessionData;
        session.markModified('data');
        await sessionRepository.saveDocument(session);
      }

      // sessionData.turnterm 동기화 (없으면 설정)
      if (!sessionData.turnterm && turnterm) {
        sessionData.turnterm = turnterm;
        sessionData.game_env.turnterm = turnterm;
      }

      // 턴 시각 이전이면 아무것도 하지 않음
      // 하지만 turntime이 너무 먼 미래라면 (turnterm * 2 이상) 잘못된 설정으로 간주하고 초기화
      const turntime = new Date(sessionData.turntime || now);
      const turntermInMinutes = sessionData.turnterm || 60; // 분 단위
      const turntermInSeconds = turntermInMinutes * 60; // 초 단위
      const timeDiff = turntime.getTime() - now.getTime();
      const timeDiffInMinutes = timeDiff / (1000 * 60);

      // 디버그: turntime 상태 로그
      if (timeDiffInMinutes < -60) {
        logger.warn('Turntime is in the past, processing overdue turns', { 
          minutesPast: Math.abs(timeDiffInMinutes).toFixed(1) 
        });
      }

      if (now < turntime) {
        // turntime이 너무 먼 미래이면 잘못된 설정으로 간주하고 현재 시간 + turnterm으로 재설정
        // 체크 기준: turnterm * 3 (최소 10분, 최대 180분)
        const maxAllowedMinutes = Math.min(Math.max(turntermInMinutes * 3, 10), 180);
        if (timeDiffInMinutes > maxAllowedMinutes) {
          logger.warn('Turntime is too far in future, resetting', { 
            timeDiffInMinutes: timeDiffInMinutes.toFixed(1), 
            maxAllowedMinutes, 
            turntermInMinutes 
          });
          const correctedTurntime = new Date(now.getTime() + turntermInSeconds * 1000);
          sessionData.turntime = correctedTurntime.toISOString();
          sessionData.game_env.turntime = correctedTurntime.toISOString();
          session.data = sessionData;
          await sessionRepository.saveDocument(session);

          if (lockAcquired) {
            await redis.del(lockKey);
            lockAcquired = false;
            logger.info('Lock released - turntime corrected', { lockKey });
          }
          return {
            success: true,
            result: false,
            updated: false,
            locked: false,
            turntime: correctedTurntime.toISOString()
          };
        }

        // 락을 해제하고 반환
        if (lockAcquired) {
          await redis.del(lockKey);
          lockAcquired = false;
          logger.debug('Lock released - turntime not reached', { lockKey });
        }
        return {
          success: true,
          result: false,
          updated: false,
          locked: false,
          turntime: turntime.toISOString()
        };
      }

      // 천통시에는 동결 - 위에서 session.status로 이미 체크했으므로 불필요
      // (레거시 호환성을 위해 유지하되, sessionData에서 isunited 가져오기)
      const isunited = sessionData.game_env?.isunited ?? sessionData.isunited ?? 0;
      if (isunited === 2 || isunited === 3) {
        // 락을 해제하고 반환
        if (lockAcquired) {
          await redis.del(lockKey);
          lockAcquired = false;
          logger.info('Lock released - game united/frozen', { lockKey, isunited });
        }
        return {
          success: true,
          result: false,
          updated: false,
          locked: true,
          turntime: turntime.toISOString()
        };
      }

      // turntime이 과거이면 턴 실행 시작
      logger.info('Turntime passed, executing turns', { 
        minutesAgo: timeDiffInMinutes.toFixed(1) 
      });

      // 락 갱신을 위한 heartbeat 시작
      logger.debug('Starting heartbeat', { lockKey, interval: LOCK_HEARTBEAT_INTERVAL });
      heartbeatInterval = setInterval(async () => {
        try {
          const exists = await redis.exists(lockKey);
          if (exists) {
            const currentTtl = await redis.ttl(lockKey);
            await redis.expire(lockKey, LOCK_TTL);
            logger.debug('Lock heartbeat renewed', { lockKey, renewedTTL: LOCK_TTL, previousTTL: currentTtl });
          } else {
            // 락이 이미 해제된 경우 heartbeat 중지
            logger.warn('Lock no longer exists, stopping heartbeat', { lockKey });
            if (heartbeatInterval) {
              clearInterval(heartbeatInterval);
              heartbeatInterval = null;
            }
          }
        } catch (error: any) {
          logger.error('Lock heartbeat failed', { error: error.message, stack: error.stack });
        }
      }, LOCK_HEARTBEAT_INTERVAL * 1000);

      let executed = false;
      let result: any;

      const executionStartTime = Date.now();
      logger.info('Starting turn execution', { sessionId, singleTurn });

      // executeAllCommands는 내부에서 락을 해제함 (세션 상태 업데이트 직후)
      result = await this.executeAllCommands(sessionId, session, sessionData, lockKey, () => {
        // 락 해제 콜백
        if (lockAcquired) {
          redis.del(lockKey).then(() => {
            lockAcquired = false;
            logger.info('Lock released after session state update', { lockKey });
          }).catch(err => {
            logger.error('Failed to release lock', { lockKey, error: err.message });
          });
        }

        // heartbeat 중지
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
      }, singleTurn);

      const executionDuration = Date.now() - executionStartTime;
      logger.info('Turn execution completed', { sessionId, duration: executionDuration });

      return {
        success: true,
        result: result.executed,
        updated: result.executed,
        locked: false,
        turntime: result.turntime
      };
    } catch (error: any) {
      logger.error('ExecuteEngine error', { error: error.message, stack: error.stack });
      return {
        success: false,
        result: false,
        reason: error.message
      };
    } finally {
      // heartbeat 중지 (혹시 아직 안 멈췄다면)
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      // 락 해제 (혹시 executeAllCommands에서 해제 못했다면)
      if (lockAcquired) {
        try {
          await redis.del(lockKey);
          lockAcquired = false;
          logger.info('Lock released in finally block', { lockKey });
        } catch (error: any) {
          logger.error('Failed to release lock in finally block', { 
            lockKey, 
            error: error.message 
          });
        }
      }
    }
  }

  /**
   * 모든 커맨드 실행 (개인 턴타임 방식)
   * 
   * 각 장수는 개별 turntime을 가지며, turntime이 현재 시각을 지나면 커맨드가 실행됨
   * 
   * @param lockKey - 락 키 (세션 상태 업데이트 후 해제용)
   * @param releaseLock - 락 해제 콜백 (세션 상태 업데이트 직후 호출)
   */
  private static async executeAllCommands(
    sessionId: string,
    session: any,
    sessionData: any,
    lockKey?: string,
    releaseLock?: () => void,
    singleTurn: boolean = false
  ) {
    const now = new Date();
    const turntermInMinutes = sessionData.turnterm || 60; // 분 단위
    const turnterm = turntermInMinutes * 60; // 초 단위로 변환

    // ========================================
    // 1. 세션 초기화 (게임 시간 계산용)
    // ========================================
    if (!sessionData.starttime) {
      const initialTurntime = sessionData.turntime || now;
      sessionData.starttime = initialTurntime instanceof Date ? initialTurntime : new Date(initialTurntime);
      session.data = sessionData;
      await sessionRepository.saveDocument(session);
      logger.warn('starttime was missing, initialized', { starttime: sessionData.starttime });
    }

    // 현재 게임 년/월 계산 (세션 기준)
    const rawTurntime = sessionData.turntime || now;
    const turntimeDate = rawTurntime instanceof Date ? rawTurntime : new Date(rawTurntime);
    const initialTurnDateTime = turntimeDate.getTime() > now.getTime() ? now : turntimeDate;

    const beforeYear = sessionData.year || sessionData.game_env?.year || 184;
    const beforeMonth = sessionData.month || 1;
    ExecuteEngineService.turnDate(initialTurnDateTime, sessionData);

    // 년/월이 변경되었으면 저장 및 월별 이벤트 처리
    if (sessionData.year !== beforeYear || sessionData.month !== beforeMonth) {
      logger.info('Game date updated', { year: sessionData.year, month: sessionData.month });

      // ========================================
      // 월 전처리 (PHP preUpdateMonthly 호출)
      // ========================================
      await this.preUpdateMonthly(sessionId, sessionData);

      session.data = sessionData;
      session.markModified('data');
      await sessionRepository.saveDocument(session);

      // 월 변경 이벤트 브로드캐스트
      GameEventEmitter.broadcastMonthChanged(
        sessionId,
        sessionData.year,
        sessionData.month,
        beforeYear,
        beforeMonth
      );

      // 봉록 지급 처리 (봄 1월: 금, 가을 7월: 쌀)
      await this.processSeasonalIncome(sessionId, sessionData);
      
      // 외교 term 감소 및 상태 전환 처리 (매월)
      await this.processDiplomacyTerm(sessionId, sessionData);

      // ========================================
      // 월 후처리 (PHP postUpdateMonthly 호출)
      // ========================================
      await this.postUpdateMonthly(sessionId, sessionData);
    }

    // scenario_id를 sessionData에 추가 (징병 등에서 병종 정보 로드 시 필요)
    // session.scenario_id는 'sangokushi' 같은 시나리오 디렉토리명
    // sessionData.scenario는 '【공백지】 일반' 같은 표시 이름이므로 혼동 주의
    if (!sessionData.scenario_id) {
      sessionData.scenario_id = session.scenario_id || 'sangokushi';
    }

    // ========================================
    // 2. 개인 턴타임 처리
    // ========================================
    // turntime이 현재 시각을 지난 장수들만 처리
    const maxActionTime = 10; // 최대 실행 시간 (초)
    const limitActionTime = new Date(now.getTime() + maxActionTime * 1000);

    let executed = false;
    let currentTurn: string | null = null;

    // turntime <= now 인 장수들의 커맨드 실행
    const [executionOver, lastTurn] = await this.executeGeneralCommandUntil(
      sessionId,
      now, // 현재 시각까지의 모든 장수 처리
      limitActionTime,
      sessionData.year || 184,
      sessionData.month || 1,
      turnterm,
      sessionData,
      singleTurn
    );

    if (executionOver) {
      // 시간 초과로 중단됨 - 다음 실행 때 나머지 처리
      if (lastTurn) {
        executed = true;
        currentTurn = lastTurn;
      }
      return { executed, turntime: currentTurn || sessionData.turntime };
    }

    // ========================================
    // 3. 세션 턴타임 업데이트 (참고용)
    // ========================================
    // 주의: 세션 turntime은 게임 시간(년/월) 계산에만 사용됨
    // 개별 장수들은 각자의 turntime을 가지고 있음

    if (lastTurn) {
      executed = true;
      currentTurn = lastTurn;
    }

    // 세션 turntime을 현재 시각으로 업데이트 (다음 실행 기준점)
    sessionData.turntime = now.toISOString();
    sessionData.game_env.turntime = now.toISOString();

    session.data = sessionData;
    session.markModified('data');
    await sessionRepository.saveDocument(session);

    // ========================================
    // 4. 캐시 무효화 및 브로드캐스트
    // ========================================
    try {
      await invalidateCache('session', sessionId);
    } catch (error: any) {
      // 캐시 무효화 실패해도 계속 진행
    }

    if (executed) {
      // ========================================
      // 5. 보급선 계산 및 전방 상태 업데이트
      // ========================================
      try {
        const { checkSupply } = await import('../../utils/supply-line');
        await checkSupply(sessionId);
        logger.info('Supply lines updated', { sessionId });
      } catch (error: any) {
        logger.error('Failed to update supply lines', { 
          sessionId, 
          error: error.message, 
          stack: error.stack 
        });
        // 보급선 업데이트 실패해도 계속 진행
      }

      // 세션 상태 업데이트
      await SessionStateService.updateSessionState(sessionId, {
        year: sessionData.year,
        month: sessionData.month,
        turntime: now,
        lastExecuted: new Date()
      });

      // ✅ 세션 상태 업데이트 완료 - 이제 락을 해제해도 안전함
      // 브로드캐스트는 락 없이 진행 (다른 인스턴스가 접근 가능)
      if (releaseLock) {
        releaseLock();
      }

      GameEventEmitter.broadcastTurnComplete(
        sessionId,
        sessionData.year * 12 + sessionData.month,
        now
      );
    } else {
      // 실행된 커맨드가 없어도 락 해제
      if (releaseLock) {
        releaseLock();
      }
    }

    return { executed, turntime: now.toISOString() };
  }

  /**
   * 특정 시각까지 장수 커맨드 실행
   */
  private static async executeGeneralCommandUntil(
    sessionId: string,
    date: Date,
    limitActionTime: Date,
    year: number,
    month: number,
    turnterm: number,
    gameEnv: any,
    singleTurn: boolean = false
  ): Promise<[boolean, string | null]> {

    // turntime이 date보다 이전인 장수들을 조회
    // turntime은 data.turntime에만 존재함
    // 세션 turntime을 기본값으로 사용하여 비교
    const sessionTurntime = gameEnv.turntime ? new Date(gameEnv.turntime) : date;

    // findBySession을 사용하여 캐시에서 조회 (캐시 미스 시 DB 조회 후 캐시에 저장)
    const generals = await generalRepository.findBySession(sessionId);

    // 각 장수의 turntime을 확인하고 date보다 이전인 것만 필터링
    // turntime은 data.turntime에만 존재함
    const eligibleGenerals = [];
    const generalsToFix = [];

    for (const general of generals) {
      const generalTurntime = general.data?.turntime;

      if (!generalTurntime) {
        // turntime이 없으면 처리 대상 (세션 turntime 기준으로 초기화)
        eligibleGenerals.push(general);
        continue;
      }

      const generalTurntimeDate = generalTurntime instanceof Date
        ? generalTurntime
        : new Date(generalTurntime);

      // turntime이 date(현재 시각)보다 이전이거나 같으면 처리 대상
      if (generalTurntimeDate <= date) {
        eligibleGenerals.push(general);
      }
    }

    // 정렬: 플레이어 우선, 그 다음 turntime 순서
    eligibleGenerals.sort((a: any, b: any) => {
      // npc: 0 = 일반 플레이어, npc: 1 = 오리지널 캐릭터 (유저 플레이)
      // npc: 2+ = AI 명장
      const aOwner = a.owner || a.data?.owner;
      const bOwner = b.owner || b.data?.owner;
      const aIsPlayer = (a.npc === 0 || a.data?.npc === 0) ||
        ((a.npc === 1 || a.data?.npc === 1) && aOwner && aOwner !== '0' && aOwner !== 'NPC');
      const bIsPlayer = (b.npc === 0 || b.data?.npc === 0) ||
        ((b.npc === 1 || b.data?.npc === 1) && bOwner && bOwner !== '0' && bOwner !== 'NPC');

      // 플레이어가 NPC보다 우선
      if (aIsPlayer && !bIsPlayer) return -1;
      if (!aIsPlayer && bIsPlayer) return 1;

      // 같은 타입이면 turntime 순서
      const aTime = a.turntime || a.data?.turntime;
      const bTime = b.turntime || b.data?.turntime;
      if (!aTime && !bTime) return 0;
      if (!aTime) return 1;
      if (!bTime) return -1;

      const aDate = aTime instanceof Date ? aTime : new Date(aTime);
      const bDate = bTime instanceof Date ? bTime : new Date(bTime);
      return aDate.getTime() - bDate.getTime();
    });


    let currentTurn: string | null = null;
    let processedCount = 0;

    // 배치 크기 설정: 동시에 처리할 장수 수 (최대값)
    const BATCH_SIZE = 50; // DB 부하 최소화 (1000명 장수 대응) - 병렬 처리 증가

    logger.debug('Processing generals in batches', { 
      totalGenerals: eligibleGenerals.length, 
      batchSize: BATCH_SIZE 
    });

    // 배치 단위로 병렬 처리
    for (let i = 0; i < eligibleGenerals.length; i += BATCH_SIZE) {
      const batch = eligibleGenerals.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(eligibleGenerals.length / BATCH_SIZE);

      logger.debug('Processing batch', { 
        batchNum, 
        totalBatches, 
        generalsInBatch: batch.length 
      });

      await Promise.all(batch.map(async (general) => {
        const owner = general.owner || general.data?.owner;
        const isPlayer = (general.npc === 0 || general.data?.npc === 0) ||
          ((general.npc === 1 || general.data?.npc === 1) && owner && owner !== '0' && owner !== 'NPC');
        processedCount++;

        // lean() 결과를 직접 사용 (재조회 제거 - 성능 개선)
        const generalDoc: any = general;

        // turntime이 미래로 설정되어 있으면 월턴 시점으로 리셋
        const generalTurntime = generalDoc.data?.turntime;
        if (generalTurntime) {
          const generalTurntimeDate = generalTurntime instanceof Date
            ? generalTurntime
            : new Date(generalTurntime);
          const now = new Date();
          if (generalTurntimeDate > now && generalTurntimeDate > date) {
            // 로컬 객체만 업데이트 (DB는 나중에 한번에)
            generalDoc.data.turntime = date.toISOString();
            if (generalDoc.turntime) {
              generalDoc.turntime = date.toISOString();
            }
          }
        }

        const generalNo = generalDoc.no || generalDoc.data?.no;
        const isPlayerGeneral = (generalDoc.npc === 0 || generalDoc.data?.npc === 0) ||
          ((generalDoc.npc === 1 || generalDoc.data?.npc === 1) && owner && owner !== '0' && owner !== 'NPC');

        // 밀린 턴을 모두 처리 (turntime이 현재 시각을 지날 때까지 반복)
        let turnsExecuted = 0;
        // 월 계산이 제대로 되므로 NPC도 밀린 턴 따라잡기 허용
        const maxTurnsPerGeneral = singleTurn ? 1 : (isPlayerGeneral ? 50 : 10);
        const now = new Date();
        
        // ✅ 성능 최적화: 루프 시작 전 한번만 계산
        const isNPC = (generalDoc.npc || generalDoc.data?.npc || 0) >= 2;
        const generalName = generalDoc.name || generalDoc.data?.name || '';
        const beforeLogTime = !isNPC ? new Date() : null;
        const nationId = generalDoc.nation || generalDoc.data?.nation || 0;
        const officerLevel = generalDoc.data?.officer_level || 0;
        let wasDeleted = false;

        while (turnsExecuted < maxTurnsPerGeneral) {
          const currActionTime = new Date();
          if (currActionTime > limitActionTime) {
            // ✅ 시간 초과 전에 처리된 턴만큼 한번에 당기기
            if (turnsExecuted > 0) {
              const pullPromises: Promise<void>[] = [
                this.pullGeneralCommand(sessionId, generalNo, turnsExecuted)
              ];
              if (nationId && officerLevel >= 5) {
                pullPromises.push(this.pullNationCommand(sessionId, nationId, officerLevel, turnsExecuted));
              }
              await Promise.all(pullPromises);

              if (!isNPC && beforeLogTime) {
                await this.printUserLogs(sessionId, generalNo, generalName, beforeLogTime, turnsExecuted);
              }
            }
            return [true, currentTurn];
          }

          // 현재 장수의 turntime 확인
          const currentGeneralTurntime = generalDoc.turntime || generalDoc.data?.turntime;
          if (!currentGeneralTurntime) {
            break;
          }

          const turntimeDate = currentGeneralTurntime instanceof Date
            ? currentGeneralTurntime
            : new Date(currentGeneralTurntime);

          // turntime이 현재 시각보다 미래면 처리 완료
          if (turntimeDate > now) {
            break;
          }

          // ✅ 핵심: turnsExecuted는 현재 실행할 턴의 슬롯 인덱스 (0부터 시작)
          // 턴1: turn_idx=0, 턴2: turn_idx=1, 턴3: turn_idx=2 ...
          const turnSlotIndex = turnsExecuted;
          turnsExecuted++;

          // ✅ 각 턴 실행 시점의 게임 년/월을 장수의 turntime 기준으로 계산
          const turnDateInfo = ExecuteEngineService.turnDate(turntimeDate, gameEnv);
          const actionYear = turnDateInfo.year;
          const actionMonth = turnDateInfo.month;

          // ✅ 성능 최적화: turn_idx=turnSlotIndex 슬롯의 명령 실행
          // 당기기는 루프 끝에서 한번만!
          const turnExecuted = await this.executeGeneralTurn(
            sessionId, generalDoc, actionYear, actionMonth, turnterm, gameEnv, turnSlotIndex
          );

          currentTurn = generalDoc.turntime || new Date().toISOString();

          if (!turnExecuted) {
            logger.debug('No command executed for turn', { generalNo, turn: turnsExecuted, slot: turnSlotIndex });
          }

          // turntime 업데이트 (메모리에서만, DB 저장은 루프 끝에서)
          const deleted = await this.updateTurnTimeCore(sessionId, generalDoc, turnterm, gameEnv);

          if (deleted) {
            wasDeleted = true;
            break; // 장수가 삭제되면 루프 종료
          }

          // data.turntime 동기화
          if (generalDoc.data && generalDoc.turntime) {
            generalDoc.data.turntime = generalDoc.turntime;
          }
        }

        // ✅ 성능 최적화: 루프 끝나고 한번에 명령 당기기 (DB 호출 횟수 대폭 감소)
        // N턴 처리 → turn_idx 0~(N-1) 삭제, N→0, N+1→1...
        if (turnsExecuted > 0 && !wasDeleted) {
          // 장수/국가 명령 당기기 (병렬 처리)
          const pullPromises: Promise<void>[] = [
            this.pullGeneralCommand(sessionId, generalNo, turnsExecuted)
          ];
          if (nationId && officerLevel >= 5) {
            pullPromises.push(this.pullNationCommand(sessionId, nationId, officerLevel, turnsExecuted));
          }
          await Promise.all(pullPromises);

          // 유저인 경우 로그 출력 (NPC는 스킵)
          if (!isNPC && beforeLogTime) {
            await this.printUserLogs(sessionId, generalNo, generalName, beforeLogTime, turnsExecuted);
          }
        }

        // 장수 정보 업데이트 브로드캐스트
        if (generalNo) {
          GameEventEmitter.broadcastGeneralUpdate(sessionId, generalNo, {
            turntime: currentTurn
          });
        }

        const deleted = turnsExecuted > 0 && !generalDoc._id; // 마지막에 삭제되었는지 확인

        // updateTurnTime에서 장수가 삭제되었으면 save() 스킵
        if (deleted) {
          return;
        }

        try {
          // 레포지토리를 통한 저장 (L1/L2 캐시 활용)
          const generalNo = generalDoc.data?.no || generalDoc.no;
          
          // turntime은 루트 레벨에 있으므로, data와 함께 전달
          const updatePayload = {
            ...generalDoc.data,
            turntime: generalDoc.turntime,  // 루트 레벨 turntime 포함
          };
          
          await generalRepository.updateBySessionAndNo(sessionId, generalNo, updatePayload);
        } catch (error: any) {
          // save() 실패 시 (장수가 삭제됨) 건너뛰기
          if (error.name === 'DocumentNotFoundError' || error.message?.includes('No document found')) {
            logger.warn(`[ExecuteEngine] General deleted during save: ${generalDoc._id}`);
            return;
          }
          throw error;
        }
      }));

      // 명령 당기기는 이제 while 루프 안에서 즉시 실행됨 (중복 실행 방지)
    }

    return [false, currentTurn];
  }

  /**
   * 개별 장수 턴 실행
   * 모든 장수는 전역 게임 년/월을 공유하며, 개별 턴 카운터로 나이 증가를 관리
   * @param turnSlotIndex 실행할 명령 슬롯 인덱스 (기본값 0, 배치 처리 시 증가)
   */
  private static async executeGeneralTurn(
    sessionId: string,
    general: any,
    year: number,
    month: number,
    turnterm: number,
    gameEnv: any,
    turnSlotIndex: number = 0
  ): Promise<boolean> {
    const generalId = general.no;
    const cityId = general.city || general.data?.city || 0;

    // city=0 (방랑/미등장) 장수는 턴 실행 스킵
    if (!cityId || cityId === 0) {
      return false;
    }

    // 전역 게임 년/월 사용 (모든 장수가 공유)
    // 장수별 턴 카운터 초기화 (없으면 0)
    if (general.turn_count === undefined || general.turn_count === null) {
      general.turn_count = 0;
    }

    // 전역 년/월 사용
    let generalYear = year;
    let generalMonth = month;

    // 전처리 (부상 경감, 병력/군량 소모 등)
    await this.preprocessCommand(sessionId, general, generalYear, generalMonth);

    // 블럭 처리
    if (await this.processBlocked(sessionId, general, generalYear, generalMonth)) {
      return true; // 블럭되어도 턴은 소모
    }

    // 국가 커맨드 실행 (수뇌부만)
    const nationId = general.nation || 0;
    const officerLevel = general.officer_level || 0;
    const hasNationTurn = nationId && officerLevel >= 5;
    if (hasNationTurn) {
      await this.processNationCommand(sessionId, general, generalYear, generalMonth, turnSlotIndex);
    }

    // 장수 커맨드 실행 (turnSlotIndex번 턴) - 휴식 포함
    let commandExecuted = false;
    try {
      commandExecuted = await this.processGeneralCommand(sessionId, general, generalYear, generalMonth, gameEnv, turnSlotIndex);
    } catch (error: any) {
      logger.error(`Command execution failed for general ${general.no}`, {
        error: error.message,
        stack: error.stack
      });
      // 실패해도 계속 진행 (턴은 소모됨)
      commandExecuted = true;
    }

    // 명령이 실행되지 않았으면 (유저가 명령 미등록) 턴 소모 안 함
    if (!commandExecuted) {
      return false;
    }

    // 계승 포인트 증가
    if (!general.inheritance) general.inheritance = {};
    if (!general.inheritance.lived_month) general.inheritance.lived_month = 0;
    general.inheritance.lived_month += 1;

    // 장수별 턴 카운터 증가 (매 턴마다)
    general.turn_count = (general.turn_count || 0) + 1;

    // age_month 증가 (매 턴마다)
    if (!general.age_month) general.age_month = 0;
    general.age_month += 1;

    // 장수별 턴 카운터가 12턴에 도달하면 나이 증가 (1년 경과)
    if (general.turn_count >= 12) {
      // 나이 증가 (12턴 = 1년)
      if (general.age === undefined || general.age === null) {
        general.age = 20; // 기본값
      }
      if (general.age < 200) {
        general.age += 1;
      }
      general.age_month = 0; // 1년 경과 시 age_month 리셋
      general.turn_count = 0; // 턴 카운터 리셋
    }

    // 커맨드 실행 완료 후 관련 캐시 무효화 및 브로드캐스트
    const generalNo = general.no || general.data?.no;
    // cityId는 위에서 이미 선언됨 - 재사용
    // nationId는 위(line 739)에서 이미 선언됨 - 재사용

    // 도시/국가 정보가 변경되었을 수 있으므로 목록 캐시만 무효화
    // entity 캐시는 saveCity/saveNation에서 이미 업데이트됨
    if (cityId) {
      try {
        await invalidateCache('city', sessionId, cityId, { targets: ['lists'] });
      } catch (error: any) {
        // 캐시 무효화 실패해도 계속 진행
      }
    }

    if (nationId) {
      try {
        await invalidateCache('nation', sessionId, nationId, { targets: ['lists'] });
      } catch (error: any) {
        // 캐시 무효화 실패해도 계속 진행
      }
    }

    // NPC가 아닌 경우에만 실시간 업데이트 브로드캐스트
    const isNPC = (general.npc || general.data?.npc || 0) >= 2;
    if (!isNPC && generalNo) {
      GameEventEmitter.broadcastGeneralUpdate(sessionId, generalNo, {
        // 주요 변경 가능 필드들
        gold: general.gold,
        rice: general.rice,
        crew: general.crew,
        atmos: general.atmos,
        train: general.train,
        injury: general.injury,
        age: general.age,
        turntime: general.turntime,
        leadership: general.leadership,
        strength: general.strength,
        intel: general.intel,
        politics: general.politics,
        charm: general.charm,
        turn_count: general.turn_count,
        age_month: general.age_month
      });

      // 도시/국가 변경 브로드캐스트
      if (cityId) {
        GameEventEmitter.broadcastCityUpdate(sessionId, cityId, { updated: true });
      }
      if (nationId) {
        GameEventEmitter.broadcastNationUpdate(sessionId, nationId, { updated: true });
      }
    }

    return true; // 턴 처리 완료
  }

  /**
   * 도시와 국가 정보 로드
   */
  private static async loadCityAndNation(general: any, sessionId: string) {
    if (general._cached_city && general._cached_nation) {
      return;
    }

    const cityId = general.city || 0;
    const nationId = general.nation || 0;

    if (cityId) {
      const city = await cityRepository.findByCityNum(sessionId, cityId);
      if (city) {
        // general이 plain object이므로 직접 할당
        general._cached_city = city;
      }
    }

    if (nationId) {
      const nation = await nationRepository.findByNationNum(sessionId, nationId);
      if (nation) {
        general._cached_nation = nation;
      }
    }
  }

  /**
   * 전처리 (부상 경감, 병력 군량 소모, 포로 탈출 시도)
   */
  private static async preprocessCommand(sessionId: string, general: any, year: number, month: number) {
    await this.applyItemPreTurnEffects(sessionId, general, year, month);

    // 포로인 경우 탈출 시도
    const prisonerOf = general.prisoner_of || general.data?.prisoner_of || 0;
    if (prisonerOf > 0) {
      try {
        const { PrisonerService } = await import('../general/Prisoner.service');
        const generalId = general.no || general.data?.no;
        const rng = this.createRNG(sessionId, year, month, generalId, 'escape');
        await PrisonerService.attemptEscape(sessionId, generalId, rng);
      } catch (error: any) {
        logger.warn('[preprocessCommand] Prisoner escape attempt failed', { 
          generalId: general.no, 
          error: error.message 
        });
      }
    }

    // 사망 체크 (부상, 노환)
    try {
      const { InjuryService } = await import('../general/Injury.service');
      const generalId = general.no || general.data?.no;
      const rng = this.createRNG(sessionId, year, month, generalId, 'death_check');
      
      // 부상으로 인한 사망 체크 (위독 상태만)
      const injury = general.injury || general.data?.injury || 0;
      if (injury >= 61) {
        const deathRate = 5; // 5% 확률
        if (rng.nextBool(deathRate / 100)) {
          const generalName = general.name || general.data?.name || '장수';
          await this.pushGeneralActionLog(
            sessionId,
            generalId,
            `<R>부상으로 인해 사망</>하였습니다.`,
            year,
            month
          );
          // 장수 삭제는 updateTurnTime에서 처리
          general.killturn = 0;
        }
      }
      
      // 노환 사망 체크 (60세 이상)
      const age = general.age || general.data?.age || 20;
      if (age >= 60) {
        const deathRate = Math.min(80, (age - 60) * 2); // (나이-60)*2%, 최대 80%
        if (rng.nextBool(deathRate / 100)) {
          const generalName = general.name || general.data?.name || '장수';
          await this.pushGeneralActionLog(
            sessionId,
            generalId,
            `<R>노환(${age}세)으로 인해 사망</>하였습니다.`,
            year,
            month
          );
          // 장수 삭제는 updateTurnTime에서 처리
          general.killturn = 0;
        }
      }
    } catch (error: any) {
      logger.warn('[preprocessCommand] Death check failed', {
        generalId: general.no,
        error: error.message
      });
    }

    // 부상 경감
    if (general.injury > 0) {
      const reduction = Math.min(3, general.injury);
      general.injury = Math.max(0, general.injury - reduction);
    }

    // 병력 군량 소모
    const crew = general.crew || 0;
    if (crew > 0) {
      const consumption = Math.ceil(crew / 500); // 500명당 군량 1
      general.rice = Math.max(0, (general.rice || 0) - consumption);

      // 군량 부족시 병력 감소
      if (general.rice <= 0) {
        const crewLoss = Math.ceil(crew * 0.05); // 5% 손실
        general.crew = Math.max(0, crew - crewLoss);

        await this.pushGeneralActionLog(
          sessionId,
          general.no,
          `<R>군량 부족</>으로 병력 ${crewLoss}명이 이탈했습니다.`,
          year,
          month
        );
      }
    }
  }

  private static async applyItemPreTurnEffects(sessionId: string, general: any, year: number, month: number) {
    if (typeof general.getItems !== 'function') {
      return;
    }

    const items = general.getItems();
    const generalLogger = typeof general.getLogger === 'function' ? general.getLogger() : null;

    for (const [slot, item] of Object.entries(items)) {
      if (!item || typeof item.onPreTurnExecute !== 'function') {
        continue;
      }

      try {
        const shouldConsume = await item.onPreTurnExecute(general, {
          sessionId,
          year,
          month,
          logger: generalLogger
        });

        if (shouldConsume && typeof general.deleteItem === 'function') {
          general.deleteItem(slot as any);
        }
      } catch (error: any) {
        logger.warn('[ExecuteEngine] Failed to run pre-turn item effect', {
          slot,
          generalId: general?.no,
          error: error?.message || error
        });
      }
    }
  }

  /**
   * 블럭 처리
   */
  private static async processBlocked(sessionId: string, general: any, year: number, month: number): Promise<boolean> {
    const blocked = general.block || 0;
    if (blocked < 2) {
      return false;
    }

    let message = '';
    if (blocked === 2) {
      message = '현재 멀티, 또는 비매너로 인한 <R>블럭</> 대상자입니다.';
    } else if (blocked === 3) {
      message = '현재 악성유저로 분류되어 <R>블럭</> 대상자입니다.';
    } else {
      return false; // 블럭되지 않은 경우
    }

    // 블럭된 경우에만 killturn 감소
    const killturn = general.killturn || 0;
    general.killturn = Math.max(0, killturn - 1);

    await this.pushGeneralActionLog(sessionId, general.no, message, year, month);
    return true;
  }

  /**
   * 국가 커맨드 실행
   * PHP TurnExecutionHelper::processNationCommand() 완전 구현
   * @param turnSlotIndex 실행할 명령 슬롯 인덱스 (배치 처리 시 0, 1, 2...)
   */
  private static async processNationCommand(sessionId: string, general: any, year: number, month: number, turnSlotIndex: number = 0) {
    const nationId = general.nation || 0;
    const officerLevel = general.officer_level || 0;

    if (nationId === 0 || officerLevel < 5) {
      return;
    }

    // ✅ 성능 최적화: turnSlotIndex번 턴 조회 (배치 처리 시 0, 1, 2... 순서대로)
    const nationTurn = await nationTurnRepository.findOneByFilter({
      session_id: sessionId,
      'data.nation_id': nationId,
      'data.officer_level': officerLevel,
      'data.turn_idx': turnSlotIndex
    });

    if (!nationTurn) {
      return;
    }

    const turnData = nationTurn.data || nationTurn;
    const action = turnData.action || '휴식';
    const arg = turnData.arg || {};

    // ✅ 예약 시 저장된 년/월이 있으면 사용 (정확성 보장)
    const expectedYear = turnData.expected_year;
    const expectedMonth = turnData.expected_month;
    
    if (expectedYear !== undefined && expectedMonth !== undefined) {
      if (expectedYear !== year || expectedMonth !== month) {
        logger.warn('Nation command year/month mismatch', {
          nationId,
          officerLevel,
          turnSlotIndex,
          expected: `${expectedYear}년 ${expectedMonth}월`,
          calculated: `${year}년 ${month}월`,
          action
        });
      }
      year = expectedYear;
      month = expectedMonth;
    }

    if (action === '휴식') {
      return;
    }

    const CommandClass = getNationCommand(action);
    if (!CommandClass) {
      await this.pushGeneralActionLog(
        sessionId,
        general.no,
        `<R>알 수 없는 국가 커맨드:</> ${action}`,
        year,
        month
      );
      return;
    }

    try {
      await this.loadCityAndNation(general, sessionId);

      // LastTurn 조회 (국가 커맨드는 lastTurn 필요)
      const { KVStorage } = await import('../../models/kv-storage.model');
      const nationStor = await kvStorageRepository.findOneByFilter({
        session_id: sessionId,
        key: `turn_last_${officerLevel}`,
        namespace: `nation_${nationId}`
      });

      const lastTurnData = nationStor?.value || { command: '휴식', arg: null, term: 0, seq: 0 };
      const { LastTurn } = await import('../../commands/base/BaseCommand');
      const lastTurn = new LastTurn(
        lastTurnData.command || '휴식',
        lastTurnData.arg || null,
        lastTurnData.term || 0,
        lastTurnData.seq || 0
      );

      const env = { year, month, session_id: sessionId };
      // 수정: lastTurn은 별도로 처리하고, BaseCommand 생성자에는 (general, env, arg)만 전달
      let command = new CommandClass(general, env, arg);

      // PHP 로직: while(true)로 조건 체크 및 실행 반복
      while (true) {
        if (!command.hasFullConditionMet()) {
          const date = general.getTurnTime?.(general.TURNTIME_HM) || `${year}년 ${month}월`;
          const failString = command.getFailString?.() || '조건 미충족';
          const text = `${failString} <1>${date}</>`;
          await this.pushGeneralActionLog(sessionId, general.no, text, year, month);
          break;
        }

        if (!command.addTermStack?.()) {
          const date = general.getTurnTime?.(general.TURNTIME_HM) || `${year}년 ${month}월`;
          const termString = command.getTermString?.() || '턴 부족';
          const text = `${termString} <1>${date}</>`;
          await this.pushGeneralActionLog(sessionId, general.no, text, year, month);
          break;
        }

        // RNG 생성 (PHP와 동일한 시드 사용)
        const rng = this.createRNG(sessionId, year, month, general.no, action);
        
        let result = false;
        try {
          const generalName = general.name || general.data?.name || `장수${general.no}`;
          console.log(`[ExecuteEngine] 국가 커맨드 실행: ${action}, 장수: ${generalName}, 국가: ${nationId}`);
          result = await command.run(rng);
          console.log(`[ExecuteEngine] 국가 커맨드 완료: ${action}, 결과: ${result}`);
        } catch (cmdError: any) {
          const generalName = general.name || general.data?.name || `장수${general.no}`;
          console.error(`[ExecuteEngine] 국가 커맨드 실행 에러: ${action}, 장수: ${generalName}(${general.no}), 국가: ${nationId}`);
          console.error(`[ExecuteEngine] 에러 메시지:`, cmdError?.message || cmdError);
          console.error(`[ExecuteEngine] 스택:`, cmdError?.stack);
          
          // 에러 로그 기록
          const errorText = `<R>커맨드 실행 중 오류 발생:</> ${cmdError?.message || '알 수 없는 오류'}`;
          await this.pushGeneralActionLog(sessionId, general.no, errorText, year, month);
          
          // WebSocket으로 에러 브로드캐스트 (프론트엔드에 실시간 알림)
          try {
            const { GameEventEmitter } = await import('../gameEventEmitter');
            GameEventEmitter.broadcastCommandError(sessionId, general.no, action, cmdError?.message || '알 수 없는 오류', cmdError?.stack);
          } catch (e) {
            // 브로드캐스트 실패는 무시
          }
        }

        // 로그 flush
        try {
          const generalObj = command.getGeneral?.();
          if (generalObj && typeof generalObj.getLogger === 'function') {
            const commandLogger = generalObj.getLogger();
            if (commandLogger && typeof commandLogger.flush === 'function') {
              await commandLogger.flush();
            }
          }
        } catch (error: any) {
          logger.error('Failed to flush nation command logger', { error: error.message });
        }

        if (result) {
          // 성공 시 setNextAvailable 호출
          await command.setNextAvailable?.();

          // resultTurn 저장
          const resultTurn = command.getResultTurn?.() || lastTurn;
          if (nationStor) {
            await kvStorageRepository.updateOneByFilter(
              {
                session_id: sessionId,
                key: `turn_last_${officerLevel}`,
                namespace: `nation_${nationId}`
              },
              {
                value: {
                  command: resultTurn.getCommand(),
                  arg: resultTurn.getArg(),
                  term: resultTurn.getTerm(),
                  seq: resultTurn.getSeq()
                }
              }
            );
          } else {
            await kvStorageRepository.create({
              session_id: sessionId,
              key: `turn_last_${officerLevel}`,
              namespace: `nation_${nationId}`,
              value: {
                command: resultTurn.getCommand(),
                arg: resultTurn.getArg(),
                term: resultTurn.getTerm(),
                seq: resultTurn.getSeq()
              }
            });
          }
          break;
        }

        // 실패 시 대체 커맨드 확인
        const alt = command.getAlternativeCommand?.();
        if (alt === null) {
          break;
        }
        command = alt;
      }
    } catch (error: any) {
      logger.error('Nation command execution failed', { 
        action, 
        nationId, 
        error: error.message, 
        stack: error.stack 
      });
      await this.pushGeneralActionLog(
        sessionId,
        general.no,
        `<R>국가 커맨드 실행 실패:</> ${action} (${error.message})`,
        year,
        month
      );
    }
  }

  /**
   * 장수 커맨드 실행
   * PHP TurnExecutionHelper::processCommand() 완전 구현
   */
  private static async processGeneralCommand(
    sessionId: string,
    general: any,
    year: number,
    month: number,
    gameEnv: any,
    turnSlotIndex: number = 0
  ): Promise<boolean> {
    // generalId는 top-level no 또는 data.no일 수 있음
    const generalId = general.no || general.data?.no;

    if (!generalId) {
      logger.error('processGeneralCommand: generalId not found', { generalMongoId: general._id });
      return;
    }

    // ✅ 성능 최적화: turnSlotIndex번 턴 조회 (배치 처리 시 0, 1, 2... 순서대로)
    let generalTurn = await generalTurnRepository.findOneByFilter({
      session_id: sessionId,
      'data.general_id': generalId,
      'data.turn_idx': turnSlotIndex
    });

    let action = '휴식';
    let arg = {};

    // ✅ 예약 시 저장된 년/월이 있으면 사용 (정확성 보장)
    // 없으면 계산된 년/월 사용 (이전 버전 호환)
    const expectedYear = generalTurn?.data?.expected_year;
    const expectedMonth = generalTurn?.data?.expected_month;
    
    if (expectedYear !== undefined && expectedMonth !== undefined) {
      // 예약 시 저장된 년/월과 계산된 년/월 비교 (디버깅)
      if (expectedYear !== year || expectedMonth !== month) {
        logger.warn('Year/month mismatch detected', {
          generalId,
          turnSlotIndex,
          expected: `${expectedYear}년 ${expectedMonth}월`,
          calculated: `${year}년 ${month}월`,
          action: generalTurn?.data?.action
        });
      }
      // 예약 시 저장된 값 사용
      year = expectedYear;
      month = expectedMonth;
    }

    // 디버그: generalTurn 구조 확인
    if (generalTurn) {
      logger.debug('General turn data found', {
        generalId,
        action: generalTurn.data?.action || generalTurn.action,
        arg: generalTurn.data?.arg || generalTurn.arg,
        expectedYear,
        expectedMonth,
        hasData: !!generalTurn.data
      });
    }

    // 명령이 없는 경우
    if (!generalTurn) {
      const npcType = general.npc || general.data?.npc || 0;
      const owner = general.owner || general.data?.owner || '0';
      const generalName = general.name || general.data?.name || `General ${generalId}`;

      // owner가 'NPC', '0', 0, null, undefined이면 AI 조종
      // owner가 유저 ID (숫자 > 0 또는 문자열)이면 플레이어 조종
      const isNPCOwned = !owner || owner === '0' || owner === 0 || owner === 'NPC';
      const hasUserOwner = !isNPCOwned;

      if (hasUserOwner) {
        // 유저가 빙의했는데 명령이 없으면 휴식으로 처리 (PHP와 동일)
        logger.debug('Player-controlled general has no command, resting', { 
          generalName 
        });
        const date = `${year}년 ${month}월`;
        await this.pushGeneralActionLog(
          sessionId,
          generalId,
          `아무것도 실행하지 않았습니다. <1>${date}</>`,
          year,
          month
        );
        return true; // 휴식으로 턴 처리됨
      }

      // 유저가 빙의하지 않은 NPC는 명령이 없으면 AI가 결정
      logger.debug('NPC has no command, will try AI decision', { 
        generalName, 
        npcType 
      });
      action = '휴식';
      arg = {};
    } else {
      action = generalTurn.data?.action || generalTurn.action || '휴식';
      arg = generalTurn.data?.arg || generalTurn.arg || {};

      logger.debug('General command loaded from DB', { generalId, action, arg });
      
      // 디버깅: 징병 명령의 인자 확인
      if (action === '징병') {
        console.log(`[ExecuteEngine] 징병 명령 로드 - 장수 ${generalId}, arg:`, JSON.stringify(arg));
        console.log(`[ExecuteEngine] generalTurn 전체:`, JSON.stringify({
          data_arg: generalTurn.data?.arg,
          top_level_arg: generalTurn.arg,
          data: generalTurn.data
        }));
      }
    }

    // killturn 처리 (PHP 로직과 동일)
    // ✅ npcmode 반영: npcmode=1이면 삭턴이 1/3 (빠른 삭턴 모드)
    const npcmode = gameEnv.npcmode ?? 0;
    const baseKillturn = gameEnv.killturn || 30;
    const killturn = npcmode === 1 ? Math.floor(baseKillturn / 3) : baseKillturn;
    const npcType = general.npc || 0;
    const currentKillturn = general.killturn ?? killturn;
    const autorunMode = gameEnv.autorunMode || false; // AI 자동 실행 모드

    // NPC 타입에 따른 killturn 처리
    if (npcType >= 2) {
      // NPC (AI 명장)는 항상 killturn 감소 (삭제 방지)
      general.killturn = Math.max(0, currentKillturn - 1);
    } else if (currentKillturn > killturn) {
      general.killturn = Math.max(0, currentKillturn - 1);
    } else if (autorunMode) {
      general.killturn = Math.max(0, currentKillturn - 1);
    } else if (action === '휴식') {
      general.killturn = Math.max(0, currentKillturn - 1);
    } else {
      general.killturn = killturn;
    }

    // NPC이고 유저가 빙의하지 않았고 명령이 휴식(또는 없음)인 경우 AI가 자동으로 커맨드 결정
    const owner = general.owner || general.data?.owner || '0';
    const isNPCOwned = !owner || owner === '0' || owner === 0 || owner === 'NPC';
    const isAIControlled = isNPCOwned; // owner가 'NPC', '0', 0, null이면 AI가 조종

    // ========================================
    // NPC AI 모드 체크 (점진적 롤아웃)
    // ========================================
    // gameEnv.npc_ai_mode 값:
    // - 'disabled' 또는 false: AI 비활성화 (기본값)
    // - 'shadow': AI 결정만 로깅, 실제 적용 안함 (테스트용)
    // - 'partial': npc >= 3 (명장급)만 AI 사용
    // - 'full' 또는 true: 모든 NPC에 AI 사용
    const npcAiMode = gameEnv.npc_ai_mode || 'full'; // 기본값을 'full'로 변경하여 AI 활성화
    const aiEnabled = npcAiMode === 'full' || npcAiMode === true || 
                      npcAiMode === 'partial' || npcAiMode === 'shadow';
    
    // npc_ai_mode가 'partial'인 경우 npc >= 3 (명장급)만 AI 사용
    const shouldUseAI = aiEnabled && (
      npcAiMode === 'full' || npcAiMode === true || npcAiMode === 'shadow' ||
      (npcAiMode === 'partial' && npcType >= 3)
    );

    if (shouldUseAI && isAIControlled && (action === '휴식' || !generalTurn)) {
      try {
        const { AIEngine, AIDifficulty } = await import('../../core/ai-engine');

        // 난이도 결정 (gameEnv에서 설정 가능)
        const difficulty = gameEnv.ai_difficulty || AIDifficulty.NORMAL;

        // AI 엔진 생성 (시드는 장수 번호 + 년월 기반)
        const seed = generalId * 1000 + year * 12 + month;
        const ai = new AIEngine(difficulty, {}, seed);

        // 현재 도시와 국가 정보 로드
        await this.loadCityAndNation(general, sessionId);

        // AI가 다음 커맨드 결정 (city가 없으면 null 전달)
        const city = general._cached_city || null;
        const nation = general._cached_nation || null;

        if (!city) {
          return;
        }

        const decision = await ai.decideNextCommand(
          general,
          city,
          nation,
          { year, month, session_id: sessionId, ...gameEnv }
        );

        // 디버그 로깅 (shadow 모드에서도 항상 로깅)
        const generalName = general.name || general.data?.name || `General ${generalId}`;
        const cityName = city?.name || city?.data?.name || `City ${general.city}`;
        const nationName = nation?.name || nation?.data?.name || `Nation ${general.nation}`;
        
        logger.info('[NPC-AI] Decision', {
          mode: npcAiMode,
          generalId,
          generalName,
          npcType,
          cityName,
          nationName,
          command: decision?.command,
          reason: decision?.reason,
          priority: decision?.priority,
          args: decision?.args,
          timestamp: new Date().toISOString()
        });

        // shadow 모드: 로깅만 하고 실제 적용 안함
        if (npcAiMode === 'shadow') {
          logger.info('[NPC-AI] Shadow mode - skipping actual command application', {
            generalId,
            generalName,
            wouldExecute: decision?.command
          });
          // 휴식으로 처리
          return true;
        }

        if (decision && decision.command !== 'neutral') {
          // AI가 결정한 커맨드를 0번 턴에 설정
          await generalTurnRepository.updateOne(
            {
              session_id: sessionId,
              'data.general_id': generalId,
              'data.turn_idx': 0
            },
            {
              $set: {
                'data.action': decision.command,
                'data.arg': decision.args,
                'data.brief': `AI: ${decision.reason}`
              }
            }
          );

          // action과 arg 직접 설정 (DB 재조회 불필요)
          action = decision.command;
          arg = decision.args || {};
          logger.info('[NPC-AI] Command set', { 
            generalId, 
            generalName, 
            action, 
            arg,
            reason: decision.reason 
          });
        }
      } catch (error: any) {
        // AI 실패 시 휴식 (에러는 로깅)
        logger.error('[NPC-AI] Error', { 
          generalId, 
          generalName: general.name || general.data?.name,
          error: error.message,
          stack: error.stack 
        });
        return;
      }
    }

    // 휴식인 경우 로그만 남기고 턴 소비
    if (action === '휴식') {
      logger.debug('General is resting', { 
        generalId, 
        name: general.name || general.data?.name 
      });

      // PHP와 동일하게 날짜 포함 (년 월 형식)
      const date = `${year}년 ${month}월`;
      await this.pushGeneralActionLog(
        sessionId,
        generalId,
        `아무것도 실행하지 않았습니다. <1>${date}</>`,
        year,
        month
      );
      return true; // 휴식도 턴 처리됨
    }

    const CommandClass = getCommand(action);
    if (!CommandClass) {
      logger.error('Unknown command for general', { generalId, action });
      await this.pushGeneralActionLog(
        sessionId,
        general.no,
        `<R>알 수 없는 커맨드:</> ${action}`,
        year,
        month
      );
      return true; // 에러도 턴 소모
    }

    logger.debug('Executing command for general', { 
      generalId, 
      name: general.name || general.data?.name, 
      action, 
      arg 
    });

    let command: any = null; // catch 블록에서도 접근 가능하도록 선언

    try {
      await this.loadCityAndNation(general, sessionId);

      // 국가 소유 도시 목록 로드 (병과 제약조건 체크용)
      const nationId = general.nation || general.data?.nation || 0;
      let ownedCities: any[] = [];
      if (nationId > 0) {
        try {
          const cities = await cityRepository.findByFilter({
            session_id: sessionId,
            'data.nation': nationId
          });
          ownedCities = cities.map((city: any) => ({
            city: city.data?.city || city.city,
            name: city.data?.name || city.name,
            nation: city.data?.nation || city.nation,
            region: city.data?.region || city.region,
            level: city.data?.level || city.level,
            secu: city.data?.secu || city.secu
          }));
        } catch (error: any) {
          logger.warn(`[ExecuteEngine] Failed to load owned cities: ${error.message}`);
        }
      }

      const env = {
        year,
        month,
        session_id: sessionId,
        ownedCities,  // 제약조건에서 사용
        develcost: gameEnv.develcost || 100,  // 내정/이동 비용
        ...gameEnv
      };

      // GeneralAdapter로 래핑 (Plain Object와 Mongoose Document 모두 지원)
      const { GeneralAdapter } = await import('../../adapters/GeneralAdapter');
      const generalAdapter = new GeneralAdapter(general);

      command = new CommandClass(generalAdapter, env, arg);

      // PHP 로직: while(true)로 조건 체크 및 실행 반복
      while (true) {
        if (!command.hasFullConditionMet()) {
          const date = general.getTurnTime?.(general.TURNTIME_HM) || `${year}년 ${month}월`;
          const failString = command.getFailString?.() || '조건 미충족';
          const text = `${failString} <1>${date}</>`;
          await this.pushGeneralActionLog(sessionId, general.no, text, year, month);
          break;
        }

        if (!command.addTermStack?.()) {
          const date = general.getTurnTime?.(general.TURNTIME_HM) || `${year}년 ${month}월`;
          const termString = command.getTermString?.() || '턴 부족';
          const text = `${termString} <1>${date}</>`;
          await this.pushGeneralActionLog(sessionId, general.no, text, year, month);
          break;
        }

        // RNG 생성 (PHP와 동일한 시드 사용)
        const rng = this.createRNG(sessionId, year, month, generalId, action);
        
        let result = false;
        try {
          const generalName = general.name || general.data?.name || `장수${generalId}`;
          console.log(`[ExecuteEngine] 장수 커맨드 실행: ${action}, 장수: ${generalName}(${generalId})`);
          result = await command.run(rng);
          console.log(`[ExecuteEngine] 장수 커맨드 완료: ${action}, 장수: ${generalName}, 결과: ${result}`);
        } catch (cmdError: any) {
          const generalName = general.name || general.data?.name || `장수${generalId}`;
          console.error(`[ExecuteEngine] 장수 커맨드 실행 에러: ${action}, 장수: ${generalName}(${generalId})`);
          console.error(`[ExecuteEngine] 에러 메시지:`, cmdError?.message || cmdError);
          console.error(`[ExecuteEngine] 스택:`, cmdError?.stack);
          
          // 에러 로그 기록
          const errorText = `<R>커맨드 실행 중 오류 발생:</> ${cmdError?.message || '알 수 없는 오류'}`;
          await this.pushGeneralActionLog(sessionId, generalId, errorText, year, month);
          
          // WebSocket으로 에러 브로드캐스트 (프론트엔드에 실시간 알림)
          try {
            const { GameEventEmitter } = await import('../gameEventEmitter');
            GameEventEmitter.broadcastCommandError(sessionId, generalId, action, cmdError?.message || '알 수 없는 오류', cmdError?.stack);
          } catch (e) {
            // 브로드캐스트 실패는 무시
          }
        }

        // 로그 flush
        try {
          const generalObj = command.getGeneral?.();
          if (generalObj && typeof generalObj.getLogger === 'function') {
            const cmdLogger = generalObj.getLogger();
            if (cmdLogger && typeof cmdLogger.flush === 'function') {
              await cmdLogger.flush();
            }
          }
        } catch (error: any) {
          logger.error('Failed to flush command logger', { error: error.message });
        }

        if (result) {
          // 성공 시 setNextAvailable 호출
          await command.setNextAvailable?.();
          break;
        }

        // 실패 시 대체 커맨드 확인
        const alt = command.getAlternativeCommand?.();
        if (alt === null) {
          break;
        }
        command = alt;
      }

      // 활성화된 스킬 초기화 (PHP: $general->clearActivatedSkill())
      if (general.clearActivatedSkill) {
        general.clearActivatedSkill();
      }

      // 로거 flush는 while 루프 안에서 이미 처리됨 (1270번 줄)
      // 중복 flush 방지를 위해 제거

      return true; // 명령 실행 완료

    } catch (error: any) {
      logger.error('Command execution failed', { 
        action, 
        generalId: general.no, 
        error: error.message, 
        stack: error.stack 
      });
      await this.pushGeneralActionLog(
        sessionId,
        general.no,
        `<R>커맨드 실행 실패:</> ${action} (${error.message})`,
        year,
        month
      );

      // 에러 시 로거 flush (에러 발생 시에만 필요)
      try {
        const generalObj = command?.getGeneral?.();
        if (generalObj && typeof generalObj.getLogger === 'function') {
          const logger = generalObj.getLogger();
          if (logger && typeof logger.flush === 'function') {
            await logger.flush();
          }
        }
      } catch (flushError: any) {
        logger.error('Logger flush error', { error: flushError.message });
      }

      return true; // 에러도 턴 소모
    }
  }

  /**
   * RNG 생성 (PHP와 동일한 시드 사용)
   * PHP: new RandUtil(new LiteHashDRBG(Util::simpleSerialize(...)))
   */
  private static createRNG(sessionId: string, year: number, month: number, generalId: number, commandName: string): any {
    // RandUtil 인스턴스 생성
    const seed = `${sessionId}_${year}_${month}_${generalId}_${commandName}`;
    let seedValue = 0;
    for (let i = 0; i < seed.length; i++) {
      seedValue = ((seedValue << 5) - seedValue) + seed.charCodeAt(i);
      seedValue = seedValue & seedValue; // Convert to 32bit integer
    }

    const { RandUtil } = require('../../utils/RandUtil');
    const rng = new RandUtil(Math.abs(seedValue));

    // 레거시 호환을 위한 추가 메서드
    if (!rng.choiceUsingWeightPair) {
      rng.choiceUsingWeightPair = (pairs: any[]) => {
        if (!pairs || pairs.length === 0) return null;
        const weights = pairs.map(([, w]) => w || 0);
        const values = pairs.map(([v]) => v);
        return rng.weightedSample(values, weights);
      };
    }

    return rng;
  }

  /**
   * 턴 시간 업데이트
   * 전역 게임 년/월을 사용하여 turntime 계산
   */
  /**
   * ✅ 기존 updateTurnTime 래퍼 (호환성 유지)
   */
  private static async updateTurnTime(sessionId: string, general: any, turnterm: number, gameEnv: any): Promise<boolean> {
    return this.updateTurnTimeCore(sessionId, general, turnterm, gameEnv);
  }

  /**
   * turntime 업데이트 핵심 로직 (메모리 업데이트 + 삭제/은퇴 시에만 DB 호출)
   */
  private static async updateTurnTimeCore(sessionId: string, general: any, turnterm: number, gameEnv: any): Promise<boolean> {
    // 전역 게임 년/월 사용
    const year = gameEnv.year || 184;
    const month = gameEnv.month || 1;
    const killturn = general.killturn;

    // killturn이 undefined이거나 null이면 기본값 6 설정 (새로 생성된 장수)
    if (killturn === undefined || killturn === null) {
      general.killturn = 6;
    }

    // 삭턴 장수 처리 (killturn이 명시적으로 0 이하인 경우만)
    const finalKillturn = general.killturn || 6;
    if (finalKillturn <= 0) {
      // NPC 유저 삭턴시 NPC로 전환
      if (general.npc === 1 && general.deadyear > year) {
        await this.pushGeneralActionLog(
          sessionId,
          general.no,
          `${general.owner_name}이 ${general.name}의 육체에서 <S>유체이탈</>합니다!`,
          year,
          gameEnv.month
        );

        general.killturn = (general.deadyear - year) * 12;
        general.npc = general.npc_org || 2;
        general.owner = '0';
        general.owner_name = null;
      } else {
        // 장수 삭제
        try {
          await general.deleteOne();
          return true; // 삭제되었음을 반환
        } catch (error: any) {
          // 이미 삭제되었거나 없는 경우
          logger.warn(`[ExecuteEngine] Failed to delete general: ${general._id}`, { error: error.message });
          return true; // 삭제된 것으로 간주
        }
      }
    }

    // 은퇴 처리 (나이 제한)
    const retirementYear = 70;
    const owner = general.owner || general.data?.owner;
    const isPlayerGeneral = (general.npc === 0 || general.data?.npc === 0) ||
      ((general.npc === 1 || general.data?.npc === 1) && owner && owner !== '0' && owner !== 'NPC');
    if ((general.age ?? general.data?.age ?? 20) >= retirementYear && isPlayerGeneral) {
      if ((gameEnv.isunited ?? 0) === 0) {
        const generalNo = general.no || general.data?.no;
        if (generalNo) {
          try {
            const { CheckHallService } = await import('../admin/CheckHall.service');
            await CheckHallService.execute(generalNo, sessionId);
          } catch (error: any) {
            logger.warn('CheckHall execution failed', { 
              generalNo, 
              error: error?.message || error 
            });
          }
        }
      }

      try {
        await general.rebirth();
      } catch (error: any) {
        logger.error('Failed to process general rebirth', { 
          generalNo: general.no, 
          error: error?.message || error 
        });
      }
    }

    // 턴 시간 증가
    const sessionTurntime = gameEnv.turntime ? new Date(gameEnv.turntime) : new Date();
    let currentTurntime = general.turntime
      ? new Date(general.turntime)
      : sessionTurntime;

    // turntime이 현재 시간보다 미래면 잘못된 상태 (세션 turntime 기준으로 수정)
    const now = new Date();
    if (currentTurntime > now) {
      currentTurntime = sessionTurntime;
    }

    // addTurn은 분 단위를 받아야 함
    const defaultTurnterm = process.env.NODE_ENV === 'production' ? 60 : 1;
    const turntermInMinutes = gameEnv.turnterm || defaultTurnterm;
    let newTurntime = ExecuteEngineService.addTurn(currentTurntime, turntermInMinutes);

    // PHP: nextTurnTimeBase를 사용한 개인별 턴타임 조정
    const nextTurnTimeBase = general.aux?.nextTurnTimeBase || general.data?.aux?.nextTurnTimeBase;
    if (nextTurnTimeBase !== null && nextTurnTimeBase !== undefined) {
      // cutTurn: 턴타임을 turnterm 단위로 자르기
      newTurntime = ExecuteEngineService.cutTurn(newTurntime, turntermInMinutes);
      // nextTurnTimeBase 초 만큼 더하기
      newTurntime = new Date(newTurntime.getTime() + nextTurnTimeBase * 1000);

      // nextTurnTimeBase 초기화
      if (!general.aux) general.aux = {};
      general.aux.nextTurnTimeBase = null;
      if (general.data?.aux) {
        general.data.aux.nextTurnTimeBase = null;
      }
      general.markModified('aux');
      general.markModified('data.aux');
    }

    // custom_turn_hour/minute 지원 (개인별 턴타임 설정)
    const customHour = general.custom_turn_hour ?? general.data?.custom_turn_hour;
    const customMinute = general.custom_turn_minute ?? general.data?.custom_turn_minute;

    if (customHour !== null && customHour !== undefined &&
      customMinute !== null && customMinute !== undefined) {
      // 다음 턴타임을 지정된 시:분으로 설정
      const targetTime = new Date(newTurntime);
      targetTime.setHours(customHour, customMinute, 0, 0);

      // 만약 설정한 시간이 이미 지났다면 다음 날로
      if (targetTime <= newTurntime) {
        targetTime.setDate(targetTime.getDate() + 1);
      }

      newTurntime = targetTime;
    }

    general.turntime = newTurntime.toISOString();

    return false; // 삭제되지 않음
  }

  /**
   * 턴 당기기 (장수)
   * ✅ 성능 최적화: DB 업데이트만 수행, 로그 출력은 별도 함수로 분리
   */
  private static async pullGeneralCommand(sessionId: string, generalId: number, turnCnt: number) {
    if (turnCnt === 0 || turnCnt >= MAX_TURN) {
      return;
    }

    // ✅ bulkWrite로 2개 쿼리를 1개로 통합
    await generalTurnRepository.bulkWrite([
      // 모든 턴을 turnCnt만큼 당김 (1→0, 2→1, ...)
      {
        updateMany: {
          filter: {
            session_id: sessionId,
            'data.general_id': generalId
          },
          update: { $inc: { 'data.turn_idx': -turnCnt } }
        }
      },
      // 음수가 된 턴들 삭제 (원래 0~(turnCnt-1)번 턴이 음수가 됨)
      {
        deleteMany: {
          filter: {
            session_id: sessionId,
            'data.general_id': generalId,
            'data.turn_idx': { $lt: 0 }
          }
        }
      }
    ]);
  }

  /**
   * 유저 로그 출력 (배치 처리 완료 후 한번만 호출)
   */
  private static async printUserLogs(sessionId: string, generalId: number, generalName: string, beforeLogTime: Date, turnCnt: number) {
    try {
      const { GeneralRecord } = await import('../../models/general_record.model');

      // 배치 처리 동안 생성된 모든 로그 가져오기
      const logs = await GeneralRecord.find({
        session_id: sessionId,
        general_id: generalId,
        created_at: { $gte: beforeLogTime }
      })
        .sort({ created_at: 1 })
        .limit(turnCnt * 5) // 턴당 최대 5개 로그
        .lean();

      if (logs.length > 0) {
        logger.info(`[${generalName}] ${turnCnt}턴 처리 완료, ${logs.length}개 로그`, {
          generalId,
          turnCnt,
          logCount: logs.length
        });
      }
    } catch (error) {
      // 로그 조회 실패는 무시
    }
  }

  /**
   * 턴 당기기 (국가)
   */
  private static async pullNationCommand(sessionId: string, nationId: number, officerLevel: number, turnCnt: number) {
    if (!nationId || officerLevel < 5 || turnCnt === 0 || turnCnt >= MAX_CHIEF_TURN) {
      return;
    }

    // ✅ bulkWrite로 2개 쿼리를 1개로 통합
    await nationTurnRepository.bulkWrite([
      {
        updateMany: {
          filter: {
            session_id: sessionId,
            'data.nation_id': nationId,
            'data.officer_level': officerLevel
          },
          update: { $inc: { 'data.turn_idx': -turnCnt } }
        }
      },
      {
        deleteMany: {
          filter: {
            session_id: sessionId,
            'data.nation_id': nationId,
            'data.officer_level': officerLevel,
            'data.turn_idx': { $lt: 0 }
          }
        }
      }
    ]);
  }

  /**
   * 이벤트 핸들러 실행
   * PHP TurnExecutionHelper::runEventHandler와 동일
   */
  static async runEventHandler(sessionId: string, target: string, gameEnv: any) {
    const { Event } = await import('../../models/event.model');
    const { EventHandler } = await import('../../core/event/EventHandler');

    // target을 PHP의 EventTarget 형식으로 변환
    const targetMap: Record<string, string> = {
      'PRE_MONTH': 'PRE_MONTH',
      'MONTH': 'MONTH',
      'OCCUPY_CITY': 'OCCUPY_CITY',
      'DESTROY_NATION': 'DESTROY_NATION',
      'UNITED': 'UNITED'
    };

    const dbTarget = targetMap[target] || target;

    // 이벤트 조회
    const events = await Event.find({
      session_id: sessionId,
      target: dbTarget
    }).sort({ priority: -1, _id: 1 }).exec();

    if (events.length === 0) {
      return false;
    }

    // 환경 변수 준비
    const e_env = { ...gameEnv };

    // 각 이벤트 실행
    for (const rawEvent of events) {
      const eventID = rawEvent._id.toString();
      const cond = rawEvent.condition;
      const action = rawEvent.action;

      const event = new EventHandler(cond, Array.isArray(action) ? action : [action]);
      e_env.currentEventID = eventID;

      try {
        await event.tryRunEvent(e_env);
      } catch (error: any) {
        logger.error('Event execution failed', { 
          eventID, 
          error: error.message, 
          stack: error.stack 
        });
      }
    }

    return true;
  }

  /**
   * 월 전처리 (PHP preUpdateMonthly 완전 구현)
   * - 벌점 감소, 건국제한-1, 전략제한-1, 외교제한-1
   * - 세율 동기화, 도시 상태 변화, 첩보 정보 감소
   */
  private static async preUpdateMonthly(sessionId: string, gameEnv: any) {
    const year = gameEnv.year || 184;
    const month = gameEnv.month || 1;
    const startyear = gameEnv.startyear || gameEnv.startYear || 184;
    
    logger.info('[preUpdateMonthly] Starting monthly pre-processing', { sessionId, year, month });

    // ========================================
    // 1. 장수 관련 처리
    // ========================================
    
    // penalty 감소 (벌점-1)
    await generalRepository.updateManyByFilter(
      { session_id: sessionId, 'data.penalty': { $gt: 0 } },
      { $inc: { 'data.penalty': -1 } }
    );

    // 건국제한-1 (makelimit)
    await generalRepository.updateManyByFilter(
      { session_id: sessionId, 'data.makelimit': { $gt: 0 } },
      { $inc: { 'data.makelimit': -1 } }
    );

    // 접속률 감소 (refresh_score_total * 0.99) - 선택적 구현
    // await generalRepository.updateManyByFilter(
    //   { session_id: sessionId },
    //   { $mul: { 'data.refresh_score_total': 0.99 } }
    // );

    // ========================================
    // 2. 국가 관련 처리
    // ========================================
    
    // 전략제한-1 (strategic_cmd_limit)
    await nationRepository.updateManyByFilter(
      { session_id: sessionId, 'data.strategic_cmd_limit': { $gt: 0 } },
      { $inc: { 'data.strategic_cmd_limit': -1 } }
    );

    // 외교제한-1 (surlimit)
    await nationRepository.updateManyByFilter(
      { session_id: sessionId, 'data.surlimit': { $gt: 0 } },
      { $inc: { 'data.surlimit': -1 } }
    );

    // 세율 동기화 (rate_tmp = rate)
    const nations = await nationRepository.findByFilter({ session_id: sessionId });
    for (const nation of nations) {
      const nationId = nation.nation || nation.data?.nation;
      if (!nationId) continue;
      
      const rate = nation.data?.rate ?? nation.rate ?? 20;
      await nationRepository.updateByNationNum(sessionId, nationId, {
        rate_tmp: rate
      });
    }

    // consecu_turn_count, last_war_month 감소
    await nationRepository.updateManyByFilter(
      { session_id: sessionId, 'data.consecu_turn_count': { $gt: 0 } },
      { $inc: { 'data.consecu_turn_count': -1 } }
    );
    await nationRepository.updateManyByFilter(
      { session_id: sessionId, 'data.last_war_month': { $gt: 0 } },
      { $inc: { 'data.last_war_month': -1 } }
    );

    // ========================================
    // 3. 개발비용 계산 (develcost)
    // ========================================
    // PHP: $develcost = ($admin['year'] - $admin['startyear'] + 10) * 2;
    const develcost = (year - startyear + 10) * 2;
    gameEnv.develcost = develcost;

    // ========================================
    // 4. 도시 상태 처리
    // ========================================
    await this.processCityStateTransitions(sessionId);

    // ========================================
    // 5. 첩보 정보 감소 (spy-1)
    // ========================================
    await this.processSpyInfoDecay(sessionId);

    logger.info('[preUpdateMonthly] Monthly pre-processing completed', { sessionId, develcost });
  }

  /**
   * 도시 상태 전환 처리 (PHP preUpdateMonthly 224-237줄)
   * 계략/전쟁 상태 자연 해소:
   * - 31→0, 32→31, 33→0, 34→33
   * - 41→0, 42→41, 43→42
   */
  private static async processCityStateTransitions(sessionId: string) {
    const { City } = await import('../../models/city.model');

    // state 전환 처리 (PHP CASE문과 동일)
    const stateTransitions: Record<number, number> = {
      31: 0,   // 계략 상태 해제
      32: 31,  // 계략 상태 감소
      33: 0,   // 계략 상태 해제
      34: 33,  // 계략 상태 감소
      41: 0,   // 전쟁 상태 해제
      42: 41,  // 전쟁 상태 감소
      43: 42   // 전쟁 상태 감소
    };

    for (const [fromState, toState] of Object.entries(stateTransitions)) {
      await City.updateMany(
        { session_id: sessionId, state: parseInt(fromState) },
        { $set: { state: toState } }
      );
    }

    // term 감소 (0 미만으로 안 내려감)
    await City.updateMany(
      { session_id: sessionId, term: { $gt: 0 } },
      { $inc: { term: -1 } }
    );

    // term이 0이 되면 conflict 초기화
    await City.updateMany(
      { session_id: sessionId, term: 0 },
      { $set: { conflict: '{}' } }
    );

    logger.debug('[processCityStateTransitions] City state transitions processed', { sessionId });
  }

  /**
   * 첩보 정보 감소 처리 (PHP preUpdateMonthly 240-254줄)
   * spy 객체의 각 도시별 첩보 기간을 1씩 감소
   */
  private static async processSpyInfoDecay(sessionId: string) {
    const { Nation } = await import('../../models/nation.model');

    const nations = await Nation.find({
      session_id: sessionId,
      $or: [
        { spy: { $ne: '' } },
        { spy: { $ne: '{}' } },
        { 'data.spy': { $ne: '' } },
        { 'data.spy': { $ne: '{}' } }
      ]
    });

    for (const nation of nations) {
      const nationId = nation.nation || nation.data?.nation;
      const rawSpy = nation.data?.spy || nation.spy || '{}';
      
      let spyInfo: Record<string, number>;
      try {
        spyInfo = typeof rawSpy === 'string' ? JSON.parse(rawSpy) : rawSpy;
      } catch {
        spyInfo = {};
      }

      if (Object.keys(spyInfo).length === 0) continue;

      // 각 도시의 첩보 기간 감소
      const updatedSpyInfo: Record<string, number> = {};
      for (const [cityNo, remainMonth] of Object.entries(spyInfo)) {
        const newRemain = (remainMonth as number) - 1;
        if (newRemain > 0) {
          updatedSpyInfo[cityNo] = newRemain;
        }
        // 0 이하면 삭제 (첩보 만료)
      }

      await Nation.updateOne(
        { session_id: sessionId, nation: nationId },
        { 
          $set: { 
            spy: JSON.stringify(updatedSpyInfo),
            'data.spy': JSON.stringify(updatedSpyInfo)
          } 
        }
      );
    }

    logger.debug('[processSpyInfoDecay] Spy info decay processed', { sessionId });
  }

  /**
   * 월 후처리 (PHP postUpdateMonthly 완전 구현)
   * - 국력 계산, 전쟁기한 세팅, 방랑군 해체
   * - 장수 수 업데이트, 전방 설정
   */
  private static async postUpdateMonthly(sessionId: string, gameEnv: any) {
    const year = gameEnv.year || 184;
    const month = gameEnv.month || 1;
    const startyear = gameEnv.startyear || gameEnv.startYear || 184;

    logger.info('[postUpdateMonthly] Starting monthly post-processing', { sessionId, year, month });

    // ========================================
    // 1. 도시 자연 성장/감소
    // ========================================
    const cities = await cityRepository.findByFilter({ session_id: sessionId });

    for (const city of cities) {
      const cityNum = city.city || city.data?.city;
      const pop = city.pop || city.data?.pop || 0;
      const agri = city.agri || city.data?.agri || 0;
      const comm = city.comm || city.data?.comm || 0;
      const secu = city.secu || city.data?.secu || 0;
      const def = city.def || city.data?.def || 0;
      const pop_max = city.pop_max || city.data?.pop_max || 10000;
      const agri_max = city.agri_max || city.data?.agri_max || 10000;
      const comm_max = city.comm_max || city.data?.comm_max || 10000;

      const newPop = Math.min(pop + Math.floor(agri / 10), pop_max);
      const newAgri = Math.min(agri + Math.floor(agri / 100), agri_max);
      const newComm = Math.min(comm + Math.floor(comm / 100), comm_max);
      const newSecu = Math.max(secu - 5, 0);
      const newDef = Math.max(def - 3, 0);

      await cityRepository.updateByCityNum(sessionId, cityNum, {
        pop: newPop,
        agri: newAgri,
        comm: newComm,
        secu: newSecu,
        def: newDef
      });
    }

    // ========================================
    // 2. 국력(power) 계산 및 저장
    // ========================================
    await this.calculateNationPower(sessionId, gameEnv);

    // ========================================
    // 3. 전쟁기한 세팅 (dead 기반)
    // ========================================
    await this.processWarTermSetting(sessionId, gameEnv);

    // ========================================
    // 4. available_war_setting_cnt 증가
    // ========================================
    await this.processWarSettingCntIncrease(sessionId);

    // ========================================
    // 5. 방랑군 자동 해체 (초반 2년 이후)
    // ========================================
    if (year >= startyear + 2) {
      await this.checkWander(sessionId, gameEnv);
    }

    // ========================================
    // 6. 장수 수 업데이트
    // ========================================
    try {
      const { updateGeneralNumber } = await import('../../utils/supply-line');
      await updateGeneralNumber(sessionId);
    } catch (error: any) {
      logger.error('[postUpdateMonthly] Failed to update general numbers', {
        sessionId,
        error: error.message
      });
    }

    // ========================================
    // 7. 국가 재정 처리
    // ========================================
    const nations = await nationRepository.findByFilter({ session_id: sessionId });
    for (const nation of nations) {
      const nationId = nation.nation || nation.data?.nation;
      if (nationId) {
        try {
          const { NationFinanceService } = await import('../nation/NationFinance.service');
          await NationFinanceService.applyFinanceUpdate(sessionId, nationId, year, month);
        } catch (error: any) {
          logger.error('Failed to apply finance update for nation', { 
            nationId, 
            error: error.message 
          });
        }
      }
    }

    // ========================================
    // 8. 천통 체크 (통일 여부)
    // ========================================
    try {
      const { NationDestructionService } = await import('../nation/NationDestruction.service');
      await NationDestructionService.checkUnification(sessionId);
    } catch (error: any) {
      logger.warn('[postUpdateMonthly] Unification check failed', {
        sessionId,
        error: error.message
      });
    }

    // ========================================
    // 9. 경매 처리
    // ========================================
    try {
      const { processAuction } = await import('../auction/AuctionEngine.service');
      await processAuction(sessionId);
    } catch (error: any) {
      logger.error('Error processing auctions', {
        sessionId,
        error: error.message,
        stack: error.stack
      });
    }

    try {
      const { registerAuction } = await import('../auction/AuctionEngine.service');
      await registerAuction(sessionId);
    } catch (error: any) {
      logger.error('Error registering auctions', {
        sessionId,
        error: error.message,
        stack: error.stack
      });
    }

    // ========================================
    // 10. 전방 설정 (모든 국가)
    // ========================================
    try {
      const { SetNationFront } = await import('../../utils/supply-line');
      for (const nation of nations) {
        const nationId = nation.nation || nation.data?.nation;
        const level = nation.level || nation.data?.level || 0;
        if (nationId && level > 0) {
          await SetNationFront(sessionId, nationId);
        }
      }
    } catch (error: any) {
      logger.error('[postUpdateMonthly] Failed to set nation fronts', {
        sessionId,
        error: error.message
      });
    }

    logger.info('[postUpdateMonthly] Monthly post-processing completed', { sessionId });
  }

  /**
   * 국력(power) 계산 (PHP postUpdateMonthly 288-334줄)
   * 국력 = (금+쌀)/100 + 기술력 + 인구*내정% + 장수능력 + 숙련도 + 명성공헌
   */
  private static async calculateNationPower(sessionId: string, gameEnv: any) {
    const nations = await nationRepository.findByFilter({ session_id: sessionId });
    const rng = this.createRNG(sessionId, gameEnv.year || 184, gameEnv.month || 1, 0, 'power_calc');

    for (const nation of nations) {
      const nationId = nation.nation || nation.data?.nation;
      if (!nationId || nationId === 0) continue;

      const level = nation.level || nation.data?.level || 0;
      if (level === 0) continue; // 방랑군 제외

      try {
        // 국가 자원
        const nationGold = nation.data?.gold || nation.gold || 0;
        const nationRice = nation.data?.rice || nation.rice || 0;
        const tech = nation.data?.tech || nation.tech || 0;

        // 장수 정보 집계
        const generals = await generalRepository.findByFilter({
          session_id: sessionId,
          'data.nation': nationId
        });

        let generalGoldRice = 0;
        let generalAbility = 0;
        let generalDex = 0;
        let generalExpDed = 0;

        for (const gen of generals) {
          const gData = gen.data || gen;
          generalGoldRice += (gData.gold || 0) + (gData.rice || 0);
          
          // 능력치: sqrt(intel * strength) * 2 + leadership / 2
          const intel = gData.intel || gData.intellect || 0;
          const strength = gData.strength || 0;
          const leadership = gData.leadership || 0;
          generalAbility += Math.sqrt(intel * strength) * 2 + leadership / 2;
          
          // leadership >= 40이면 추가 보너스
          if (leadership >= 40) {
            generalAbility += leadership * 2;
          }
          
          // 숙련도
          generalDex += (gData.dex1 || 0) + (gData.dex2 || 0) + (gData.dex3 || 0) + 
                       (gData.dex4 || 0) + (gData.dex5 || 0);
          
          // 경험/공헌
          generalExpDed += (gData.experience || 0) + (gData.dedication || 0);
        }

        // 도시 정보 집계 (보급 연결된 도시만)
        const nationCities = await cityRepository.findByFilter({
          session_id: sessionId,
          'data.nation': nationId,
          'data.supply': 1
        });

        let cityPower = 0;
        if (nationCities.length > 0) {
          let popSum = 0;
          let devSum = 0;
          let devMaxSum = 0;

          for (const city of nationCities) {
            const cData = city.data || city;
            popSum += cData.pop || 0;
            devSum += (cData.pop || 0) + (cData.agri || 0) + (cData.comm || 0) + 
                     (cData.secu || 0) + (cData.wall || 0) + (cData.def || 0);
            devMaxSum += (cData.pop_max || 1) + (cData.agri_max || 1) + (cData.comm_max || 1) + 
                        (cData.secu_max || 1) + (cData.wall_max || 1) + (cData.def_max || 1);
          }

          if (devMaxSum > 0) {
            cityPower = Math.round(popSum * devSum / devMaxSum / 100);
          }
        }

        // 국력 계산
        let power = Math.round(
          (Math.round((nationGold + nationRice + generalGoldRice) / 100) +
           tech +
           cityPower +
           generalAbility +
           Math.round(generalDex / 1000) +
           Math.round(generalExpDed / 100)) / 10
        );

        // 약간의 랜덤치 부여 (95% ~ 105%)
        const randomFactor = 0.95 + rng.next() * 0.1;
        power = Math.round(power * randomFactor);

        // 총 병력 계산
        let totalCrew = 0;
        for (const gen of generals) {
          const gData = gen.data || gen;
          totalCrew += gData.crew || 0;
        }

        // 국력 저장
        await nationRepository.updateByNationNum(sessionId, nationId, {
          power: power
        });

        // maxPower, maxCrew, maxCities 기록 (PHP와 동일)
        const currentAux = nation.data?.aux || {};
        const currentMaxPower = currentAux.maxPower || 0;
        const currentMaxCrew = currentAux.maxCrew || 0;
        const currentMaxCities = currentAux.maxCities || [];

        const updateAux: Record<string, any> = {};
        
        // maxPower 갱신
        if (power > currentMaxPower) {
          updateAux['aux.maxPower'] = power;
        }
        
        // maxCrew 갱신
        if (totalCrew > currentMaxCrew) {
          updateAux['aux.maxCrew'] = totalCrew;
        }
        
        // maxCities 갱신 (도시 수가 더 많으면)
        const nationCityNames = nationCities.map(c => c.data?.name || c.name || `도시${c.city}`);
        if (nationCityNames.length > currentMaxCities.length) {
          updateAux['aux.maxCities'] = nationCityNames;
        }

        if (Object.keys(updateAux).length > 0) {
          await nationRepository.updateByNationNum(sessionId, nationId, updateAux);
        }

      } catch (error: any) {
        logger.error('[calculateNationPower] Failed for nation', {
          nationId,
          error: error.message
        });
      }
    }

    logger.debug('[calculateNationPower] Nation power calculated', { sessionId });
  }

  /**
   * 전쟁기한 세팅 (PHP postUpdateMonthly 337-349줄)
   * dead(사상자) 기반으로 전쟁 지속 기간(term) 계산
   */
  private static async processWarTermSetting(sessionId: string, gameEnv: any) {
    const { Diplomacy } = await import('../../models/diplomacy.model');
    const { Nation } = await import('../../models/nation.model');

    // 교전 중인 외교 관계 조회 (state = 0)
    const warRelations = await Diplomacy.find({
      session_id: sessionId,
      state: 0  // 교전 중
    });

    // 국가별 장수 수 캐시
    const genNumCache: Record<number, number> = {};
    const nations = await Nation.find({ session_id: sessionId });
    for (const nation of nations) {
      const nationId = nation.nation || nation.data?.nation;
      if (nationId) {
        genNumCache[nationId] = nation.data?.gennum || nation.gennum || 1;
      }
    }

    for (const dip of warRelations) {
      const meNation = dip.me;
      const genCount = genNumCache[meNation] || 1;
      const dead = dip.dead || 0;
      let term = dip.term || 0;

      // PHP: $term = floor($dip['dead'] / 100 / $genCount);
      // 25% 참여율일때 두당 10턴에 4000명 소모 = 100명/턴/장수
      const addTerm = Math.floor(dead / 100 / genCount);
      const newDead = dead - (addTerm * 100 * genCount);
      
      // term은 0~13 사이로 제한
      const newTerm = Math.min(Math.max(term + addTerm, 0), 13);

      await Diplomacy.updateOne(
        { _id: dip._id },
        { 
          $set: { 
            term: newTerm,
            dead: Math.max(newDead, 0)
          } 
        }
      );
    }

    logger.debug('[processWarTermSetting] War term setting processed', { 
      sessionId, 
      relationsProcessed: warRelations.length 
    });
  }

  /**
   * available_war_setting_cnt 증가 (PHP postUpdateMonthly 408-421줄)
   * PHP에서는 KVStorage.nation_env에 저장됨
   */
  private static async processWarSettingCntIncrease(sessionId: string) {
    const { Nation } = await import('../../models/nation.model');
    const { KVStorage } = await import('../../models/kv-storage.model');
    
    // GameConst에서 값 가져오기 (기본값 설정)
    const maxAvailableWarSettingCnt = 3;  // GameConst.$maxAvailableWarSettingCnt
    const incAvailableWarSettingCnt = 1;  // GameConst.$incAvailableWarSettingCnt

    const nations = await Nation.find({ session_id: sessionId });

    for (const nation of nations) {
      const nationId = nation.nation || nation.data?.nation;
      if (!nationId || nationId === 0) continue;

      // PHP와 동일하게 KVStorage에서 현재 값 가져오기
      const nationStorage = await KVStorage.findOne({
        session_id: sessionId,
        storage_id: `nation_${nationId}`
      });
      
      const currentCnt = nationStorage?.data?.available_war_setting_cnt ?? 0;
      
      if (currentCnt >= maxAvailableWarSettingCnt) {
        continue;  // 이미 최대치
      }

      const newCnt = Math.min(currentCnt + incAvailableWarSettingCnt, maxAvailableWarSettingCnt);

      // KVStorage에 저장 (PHP와 동일)
      await KVStorage.updateOne(
        { session_id: sessionId, storage_id: `nation_${nationId}` },
        { $set: { 'data.available_war_setting_cnt': newCnt } },
        { upsert: true }
      );
    }

    logger.debug('[processWarSettingCntIncrease] War setting count increased', { sessionId });
  }

  /**
   * 방랑군 자동 해체 (PHP checkWander 445-467줄)
   * 초반 2년 이후 방랑군(level=0)의 대장(officer_level=12)들을 자동 해산
   */
  private static async checkWander(sessionId: string, gameEnv: any) {
    const { General } = await import('../../models/general.model');
    const { Nation } = await import('../../models/nation.model');
    const year = gameEnv.year || 184;
    const month = gameEnv.month || 1;

    logger.info('[checkWander] Checking wandering nations for auto-dissolution', { sessionId, year, month });

    // 방랑군 (level = 0) 국가의 대장 (officer_level = 12) 찾기
    // PHP: SELECT general.`no` FROM general LEFT JOIN nation ON general.nation = nation.nation 
    //      WHERE nation.`level` = 0 AND general.`officer_level` = 12
    const wanderingNations = await Nation.find({
      session_id: sessionId,
      $or: [
        { level: 0 },
        { 'data.level': 0 }
      ]
    });

    const wanderingNationIds = wanderingNations.map(n => n.nation || n.data?.nation).filter(Boolean);

    if (wanderingNationIds.length === 0) {
      logger.debug('[checkWander] No wandering nations found', { sessionId });
      return;
    }

    // 방랑군 대장들 찾기
    const wanderers = await General.find({
      session_id: sessionId,
      $or: [
        { 'data.nation': { $in: wanderingNationIds }, 'data.officer_level': 12 },
        { nation: { $in: wanderingNationIds }, officer_level: 12 }
      ]
    });

    logger.info('[checkWander] Found wandering lords', { 
      sessionId, 
      count: wanderers.length,
      nationIds: wanderingNationIds 
    });

    for (const wanderer of wanderers) {
      const generalNo = wanderer.no || wanderer.data?.no;
      const generalName = wanderer.name || wanderer.data?.name || `장수${generalNo}`;
      const nationId = wanderer.nation || wanderer.data?.nation;

      try {
        // 해산 명령 실행
        logger.info('[checkWander] Auto-dissolving wandering nation', { 
          generalNo, 
          generalName,
          nationId 
        });

        // 해산 로그 기록
        await this.pushGeneralActionLog(
          sessionId,
          generalNo,
          '초반 제한후 방랑군은 자동 해산됩니다.',
          year,
          month
        );

        // 방랑군 해산 처리 (국가 삭제 + 장수들 재야로)
        await this.dissolveWanderingNation(sessionId, nationId, generalNo, year, month);

      } catch (error: any) {
        logger.error('[checkWander] Failed to dissolve wandering nation', {
          generalNo,
          nationId,
          error: error.message
        });
      }
    }
  }

  /**
   * 방랑군 해산 처리
   */
  private static async dissolveWanderingNation(
    sessionId: string, 
    nationId: number, 
    lordGeneralNo: number,
    year: number,
    month: number
  ) {
    const { General } = await import('../../models/general.model');
    const { Nation } = await import('../../models/nation.model');

    // 해당 국가의 모든 장수를 재야로 변경
    const nationGenerals = await General.find({
      session_id: sessionId,
      $or: [
        { 'data.nation': nationId },
        { nation: nationId }
      ]
    });

    for (const gen of nationGenerals) {
      const genNo = gen.no || gen.data?.no;
      const genName = gen.name || gen.data?.name || `장수${genNo}`;

      // 재야로 변경
      await General.updateOne(
        { _id: gen._id },
        {
          $set: {
            nation: 0,
            'data.nation': 0,
            officer_level: 1,
            'data.officer_level': 1,
            officer_city: 0,
            'data.officer_city': 0
          }
        }
      );

      // 로그 기록 (대장 제외)
      if (genNo !== lordGeneralNo) {
        await this.pushGeneralActionLog(
          sessionId,
          genNo,
          `소속 세력이 해산되어 <C>재야</>가 되었습니다.`,
          year,
          month
        );
      }
    }

    // 국가 삭제 또는 비활성화
    await Nation.deleteOne({
      session_id: sessionId,
      nation: nationId
    });

    logger.info('[dissolveWanderingNation] Wandering nation dissolved', {
      sessionId,
      nationId,
      generalsAffected: nationGenerals.length
    });
  }

  /**
   * 봉록 지급 처리 (PHP ProcessIncome 호출)
   * - 봄(1월): 금 지급
   * - 가을(7월): 쌀 지급
   */
  // 중복 실행 방지용 캐시 (sessionId -> "year-month")
  private static lastIncomeProcessed: Map<string, string> = new Map();

  private static async processSeasonalIncome(sessionId: string, gameEnv: any) {
    const year = gameEnv.year;
    const month = gameEnv.month;

    // 중복 실행 방지: 같은 년/월에 이미 처리했으면 스킵
    const incomeKey = `${year}-${month}`;
    const lastProcessed = this.lastIncomeProcessed.get(sessionId);
    if (lastProcessed === incomeKey) {
      logger.debug('[ProcessIncome] Already processed for this month, skipping', { sessionId, year, month });
      return;
    }

    try {
      // 봄(1월): 금 지급
      if (month === 1) {
        logger.info('[ProcessIncome] Processing gold income (Spring)', { sessionId, year, month });
        const { ProcessIncome } = await import('../../core/event/Action/ProcessIncome');
        const incomeProcessor = new ProcessIncome('gold');
        await incomeProcessor.run({ session_id: sessionId, year, month });
        this.lastIncomeProcessed.set(sessionId, incomeKey);
      }
      // 가을(7월): 쌀 지급
      else if (month === 7) {
        logger.info('[ProcessIncome] Processing rice income (Autumn)', { sessionId, year, month });
        const { ProcessIncome } = await import('../../core/event/Action/ProcessIncome');
        const incomeProcessor = new ProcessIncome('rice');
        await incomeProcessor.run({ session_id: sessionId, year, month });
        this.lastIncomeProcessed.set(sessionId, incomeKey);
      } else {
        // 1월, 7월이 아닌 달도 기록 (다음 1월/7월까지 방지)
        this.lastIncomeProcessed.set(sessionId, incomeKey);
      }
    } catch (error: any) {
      logger.error('[ProcessIncome] Failed to process seasonal income', {
        sessionId,
        year,
        month,
        error: error.message,
        stack: error.stack
      });
    }

    // 전쟁 수입 처리 (매월)
    // - 국가별 전쟁 금 수입 (dead / 10)
    // - 부상병 회복 (dead의 20% -> pop으로 회복, dead = 0)
    try {
      const { ProcessWarIncome } = await import('../../core/event/Action/ProcessWarIncome');
      const warIncomeProcessor = new ProcessWarIncome();
      await warIncomeProcessor.run({ session_id: sessionId, year, month });
    } catch (error: any) {
      logger.error('[ProcessWarIncome] Failed to process war income', {
        sessionId,
        year,
        month,
        error: error.message,
        stack: error.stack
      });
    }

    // 도시 교역율 랜덤화 (매월)
    // - 도시 레벨에 따라 교역율 변동
    try {
      const { RandomizeCityTradeRate } = await import('../../core/event/Action/RandomizeCityTradeRate');
      const tradeRateProcessor = new RandomizeCityTradeRate();
      await tradeRateProcessor.run({ session_id: sessionId, year, month });
    } catch (error: any) {
      logger.error('[RandomizeCityTradeRate] Failed to randomize city trade rate', {
        sessionId,
        year,
        month,
        error: error.message,
        stack: error.stack
      });
    }

    // 랜덤 이벤트 처리 (매월)
    await this.processRandomEvents(sessionId, gameEnv);

    // 도시 이벤트 상태 감소 및 초기화 (매월)
    await this.processCityEventStates(sessionId);
  }

  /**
   * 외교 term 감소 및 상태 전환 처리 (PHP func_gamerule.php 393-406번줄)
   * - term을 1씩 감소
   * - 불가침(state=7) term=0 → 통상(state=2)으로
   * - 선전포고(state=1) term=0 → 전쟁(state=0, term=6)으로
   */
  private static async processDiplomacyTerm(sessionId: string, gameEnv: any) {
    const year = gameEnv.year;
    const month = gameEnv.month;
    
    try {
      const Diplomacy = (await import('../../models/diplomacy.model')).Diplomacy;
      const { ActionLogger } = await import('../../services/logger/ActionLogger');
      const globalLogger = new ActionLogger(0, 0, year, month, sessionId);
      
      // 1. 모든 외교 관계의 term을 1씩 감소 (0 미만으로는 안 내려감)
      await Diplomacy.updateMany(
        { session_id: sessionId, term: { $gt: 0 } },
        { $inc: { term: -1 } }
      );
      
      // 2. 선전포고(state=1) term=0인 것들 찾기 → 전쟁 시작 로그 및 상태 전환
      const warStartRelations = await Diplomacy.find({
        session_id: sessionId,
        state: 1,
        term: 0
      });
      
      // 개전 로그 (중복 방지: me < you인 쌍만)
      const processedPairs = new Set<string>();
      for (const rel of warStartRelations) {
        const key = rel.me < rel.you ? `${rel.me}-${rel.you}` : `${rel.you}-${rel.me}`;
        if (!processedPairs.has(key)) {
          processedPairs.add(key);
          
          // 국가 이름 가져오기
          const nationRepo = (await import('../../repositories/nation.repository')).nationRepository;
          const nation1 = await nationRepo.findByNationNum(sessionId, rel.me);
          const nation2 = await nationRepo.findByNationNum(sessionId, rel.you);
          const name1 = nation1?.name || `국가${rel.me}`;
          const name2 = nation2?.name || `국가${rel.you}`;
          
          globalLogger.pushGlobalHistoryLog(
            `<R><b>【개전】</b></><D><b>${name1}</b></>(와)과 <D><b>${name2}</b></>(이)가 <R>전쟁</>을 시작합니다.`
          );
        }
      }
      
      // 선전포고 → 전쟁으로 상태 전환
      await Diplomacy.updateMany(
        { session_id: sessionId, state: 1, term: 0 },
        { $set: { state: 0, term: 6 } }
      );
      
      // 3. 불가침(state=7) term=0 → 통상(state=2)으로
      await Diplomacy.updateMany(
        { session_id: sessionId, state: 7, term: 0 },
        { $set: { state: 2 } }
      );
      
      // 4. 전쟁(state=0) term=0인 것들 찾기 → 종전 로그 (양측 모두 term=0일 때만)
      const potentialCeasefire = await Diplomacy.find({
        session_id: sessionId,
        state: 0,
        term: 0
      });
      
      // 양측 모두 term=0인 경우만 종전
      const ceasefireProcessed = new Set<string>();
      for (const rel of potentialCeasefire) {
        const key = rel.me < rel.you ? `${rel.me}-${rel.you}` : `${rel.you}-${rel.me}`;
        if (ceasefireProcessed.has(key)) {
          // 이미 처리된 쌍 = 양측 모두 term=0
          const nationRepo = (await import('../../repositories/nation.repository')).nationRepository;
          const nation1 = await nationRepo.findByNationNum(sessionId, rel.me < rel.you ? rel.me : rel.you);
          const nation2 = await nationRepo.findByNationNum(sessionId, rel.me < rel.you ? rel.you : rel.me);
          const name1 = nation1?.name || `국가${rel.me}`;
          const name2 = nation2?.name || `국가${rel.you}`;
          
          globalLogger.pushGlobalHistoryLog(
            `<R><b>【종전】</b></><D><b>${name1}</b></>(와)과 <D><b>${name2}</b></>(이)가 <S>종전</>합니다.`
          );
          
          // 종전 처리: 양측 모두 state=2로
          await Diplomacy.updateMany(
            { 
              session_id: sessionId, 
              $or: [
                { me: rel.me, you: rel.you },
                { me: rel.you, you: rel.me }
              ]
            },
            { $set: { state: 2, term: 0 } }
          );
        } else {
          ceasefireProcessed.add(key);
        }
      }
      
      await globalLogger.flush();
      
      if (warStartRelations.length > 0) {
        logger.info('[DiplomacyTerm] War started', { 
          sessionId, 
          count: warStartRelations.length 
        });
      }
    } catch (error: any) {
      logger.error('[DiplomacyTerm] Failed to process diplomacy term', {
        sessionId,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * 도시 이벤트 상태 처리 (캐시 경유)
   * PHP와 동일: state <= 10인 도시만 초기화 (43 전쟁 상태는 유지)
   * 분기(1, 4, 7, 10월) 시작 시 호출됨
   */
  private static async processCityEventStates(sessionId: string) {
    try {
      const { saveCity } = await import('../../common/cache/model-cache.helper');
      
      // 캐시에서 모든 도시 조회
      const cities = await cityRepository.findByFilter({ session_id: sessionId });
      
      let resetCount = 0;
      
      for (const city of cities) {
        const cityNum = city.city || city.data?.city;
        const state = city.state ?? city.data?.state ?? 0;
        
        // PHP와 동일: state가 10 이하인 경우에만 초기화 (43 전쟁은 유지)
        if (state > 0 && state <= 10) {
          city.state = 0;
          city.term = 0;
          if (city.data) {
            city.data.state = 0;
            city.data.term = 0;
          }
          
          // 캐시를 통해 저장
          const cityData = city.toObject ? city.toObject() : { ...city, session_id: sessionId };
          await saveCity(sessionId, cityNum, cityData);
          resetCount++;
        }
      }
      
      if (resetCount > 0) {
        logger.info('[processCityEventStates] Reset state for cities (state <= 10)', { 
          sessionId, 
          count: resetCount 
        });
      }
      
      logger.debug('[processCityEventStates] City event states processed', { sessionId });
    } catch (error: any) {
      logger.error('[processCityEventStates] Failed to process city event states', {
        sessionId,
        error: error.message
      });
    }
  }

  /**
   * 랜덤 이벤트 처리
   * PHP RaiseDisaster와 동일한 로직:
   * - 분기별(1,4,7,10월)에만 재해/호황 이벤트 발생
   * - 4월, 7월: 25% 확률로 호황/풍작, 75% 확률로 재해
   * - 1월, 10월: 100% 재해 (호황 없음)
   * - 도시별 치안(secu) 기반 확률로 대상 선택
   */
  private static async processRandomEvents(sessionId: string, gameEnv: any) {
    const year = gameEnv.year;
    const month = gameEnv.month;
    const startYear = gameEnv.startyear || 184;

    try {
      // PHP RaiseDisaster와 동일: 재해/호황 통합 처리
      // 분기별(1,4,7,10월)에만 실행, 내부에서 호황/재해 여부 결정
      const { RandomDisaster } = await import('../../core/event/Action/RandomDisaster');
      const disasterEvent = new RandomDisaster();
      const disasterResult = await disasterEvent.run({ 
        session_id: sessionId, 
        year, 
        month,
        startyear: startYear
      });
      
      if (disasterResult.count > 0) {
        const eventType = disasterResult.eventType === 'booming' ? '호황/풍작' : '재해';
        logger.info(`[RandomEvent] ${eventType} occurred`, { 
          sessionId, 
          year, 
          month, 
          eventType: disasterResult.eventType,
          cities: disasterResult.affectedCities 
        });
      } else if (disasterResult.skipped) {
        logger.debug('[RandomEvent] Skipped', { 
          sessionId, 
          year, 
          month, 
          reason: disasterResult.skipped 
        });
      }

      // 도적 출현 이벤트 (분기별 재해/호황과 별개로 매월 실행 가능)
      // PHP에서는 황건적이 재해 목록에 포함되어 있으므로 별도 호출은 선택적
      const { BanditRaid } = await import('../../core/event/Action/BanditRaid');
      const banditEvent = new BanditRaid(0.03);
      const banditResult = await banditEvent.run({ session_id: sessionId, year, month });
      if (banditResult.count > 0) {
        logger.info('[RandomEvent] Bandit raid', { sessionId, year, month, cities: banditResult.affectedCities });
      }

    } catch (error: any) {
      logger.error('[RandomEvent] Failed to process random events', {
        sessionId,
        year,
        month,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * 분기 통계
   * TODO: 실제 통계 생성 로직 구현 필요
   */
  /**
   * 분기 통계
   * 매 분기(1, 4, 7, 10월)마다 국가 및 장수 통계를 생성하여 저장합니다.
   */
  private static async checkStatistic(sessionId: string, gameEnv: any) {
    const year = gameEnv.year;
    const month = gameEnv.month;

    // 분기 시작월(1, 4, 7, 10)이 아니면 스킵
    if ((month - 1) % 3 !== 0) {
      return;
    }

    const quarter = Math.floor((month - 1) / 3) + 1;
    logger.info('Generating statistics', { year, quarter });

    try {
      const { Statistic } = await import('../../models/statistic.model');

      // 1. 국가 통계
      const nations = await nationRepository.findByFilter({ session_id: sessionId });
      const nationStats = [];

      for (const nation of nations) {
        const nationId = nation.nation || nation.data?.nation;
        if (!nationId) continue;

        // 도시 수, 인구 수 계산
        const cities = await cityRepository.findByFilter({
          session_id: sessionId,
          'data.nation': nationId
        });

        const cityCount = cities.length;
        const population = cities.reduce((sum: number, city: any) => sum + (city.data?.pop || 0), 0);

        // 장수 수 계산
        const generals = await generalRepository.findByFilter({
          session_id: sessionId,
          'data.nation': nationId
        });
        const generalCount = generals.length;

        nationStats.push({
          nationId,
          name: nation.data?.name,
          color: nation.data?.color,
          gold: nation.data?.gold || 0,
          rice: nation.data?.rice || 0,
          cityCount,
          generalCount,
          population
        });
      }

      // 2. 장수 랭킹 (Top 10)
      const allGenerals = await generalRepository.findByFilter({ session_id: sessionId });

      const getTopGenerals = (key: string) => {
        return [...allGenerals]
          .sort((a: any, b: any) => (b.data?.[key] || 0) - (a.data?.[key] || 0))
          .slice(0, 10)
          .map((g: any) => ({
            id: g.no,
            name: g.name,
            nationId: g.nation,
            value: g.data?.[key] || 0
          }));
      };

      const generalStats = {
        leadership: getTopGenerals('leadership'),
        strength: getTopGenerals('strength'),
        intellect: getTopGenerals('intellect'),
        experience: getTopGenerals('experience'),
        dedication: getTopGenerals('dedication')
      };

      // 3. 통계 저장
      await Statistic.create({
        session_id: sessionId,
        data: {
          year,
          month,
          quarter,
          date: new Date(),
          nations: nationStats,
          generals: generalStats
        }
      });

      logger.info('Statistics saved', { year, quarter });

    } catch (error: any) {
      logger.error('Failed to generate statistics', { error: error.message, stack: error.stack });
    }
  }

  /**
   * 턴 시간에 따른 게임 내 년/월 계산
   * PHP turnDate() 함수와 동일한 로직
   * 
   * PHP 버전:
   * - cutTurn($curtime, $turnterm)으로 현재 시간을 턴 경계로 자름
   * - $num = intdiv((strtotime($curturn) - strtotime($turn)), $term * 60)
   * - $date = $startyear * 12 + $num
   * - $year = intdiv($date, 12)
   * - $month = 1 + $date % 12
   * 
   * 중요: starttime은 "게임 시작한 현실 시간", year/month는 "게임 내 시간"
   * 
   * @param turntime 현재 턴 시간 (Date 객체 또는 문자열)
   * @param gameEnv 게임 환경 데이터 (starttime, startyear, turnterm, year, month 포함)
   * @returns 계산된 년/월 정보 { year, month, turn }
   */
  public static turnDate(turntime: Date | string, gameEnv: any): { year: number; month: number; turn: number } {
    // starttime과 startyear 가져오기
    const startyear = gameEnv.startyear || gameEnv.startYear || 184;
    const turntermInMinutes = gameEnv.turnterm || 60; // 분 단위

    // curtime을 Date 객체로 변환
    const curtime = turntime instanceof Date ? turntime : new Date(turntime);
    const curturn = ExecuteEngineService.cutTurn(curtime, turntermInMinutes);

    let starttime = gameEnv.starttime ? new Date(gameEnv.starttime) : null;
    const now = new Date();

    // starttime 유효성 검증
    // 1. starttime이 없는 경우
    // 2. year가 비정상적으로 큰 경우
    // 3. starttime이 1000년 이전인 경우 (게임 년도로 잘못 설정된 경우)
    const MAX_REASONABLE_YEAR = 10000;
    const MIN_REASONABLE_STARTTIME = new Date('1000-01-01').getTime();

    const needsReset = !starttime ||
      (gameEnv.year && gameEnv.year > MAX_REASONABLE_YEAR) ||
      (starttime.getTime() < MIN_REASONABLE_STARTTIME);

    if (needsReset) {
      const reason = !starttime ? 'missing' :
        (starttime.getTime() < MIN_REASONABLE_STARTTIME ? 'too old (likely game year instead of real time)' : 'invalid year');

      // starttime을 현재 시간으로 리셋
      starttime = curturn;
      gameEnv.starttime = curturn.toISOString();
      // year/month도 시작 년도로 리셋
      gameEnv.year = startyear;
      gameEnv.month = 1;

      logger.warn('starttime reset to current time', { 
        reason, 
        newStarttime: curturn.toISOString(), 
        year: startyear, 
        month: 1 
      });
    }

    const starttimeCut = ExecuteEngineService.cutTurn(starttime, turntermInMinutes);

    // PHP: $num = intdiv((strtotime($curturn) - strtotime($turn)), $term * 60)
    // 경과한 현실 시간(분)을 turnterm으로 나눠서 경과한 턴 수 계산
    const timeDiffMinutes = (curturn.getTime() - starttimeCut.getTime()) / (1000 * 60);
    const num = Math.max(0, Math.floor(timeDiffMinutes / turntermInMinutes));

    // ⚠️ CRITICAL FIX: 오버플로우 방지
    // 비정상적으로 큰 num이 계산되었다면 starttime이 손상된 것
    // 일반적으로 starttime이 게임 년도(예: 0187-01-01)로 잘못 설정된 경우 발생
    const MAX_REASONABLE_TURNS = 50 * 365 * 24 * 60 / turntermInMinutes; // 50년치 턴으로 완화
    if (num > MAX_REASONABLE_TURNS) {
      logger.error('CRITICAL: starttime corruption detected', { 
        calculatedTurns: num, 
        maxReasonableTurns: MAX_REASONABLE_TURNS, 
        starttime: starttime.toISOString(), 
        curturn: curturn.toISOString() 
      });

      // starttime을 현재 시간으로 강제 리셋하고 년/월을 startyear로 초기화
      const correctedStarttime = curturn;
      gameEnv.starttime = correctedStarttime.toISOString();
      gameEnv.year = startyear;
      gameEnv.month = 1;

      logger.info('Fixed starttime corruption', { 
        newStarttime: correctedStarttime.toISOString(), 
        year: startyear, 
        month: 1 
      });

      // 수정된 값 반환 (호출한 쪽에서 DB 저장)
      return { year: startyear, month: 1, turn: 1 };
    }

    // PHP와 완전히 동일한 방식:
    // $date = $admin['startyear'] * 12 + $num;
    // $year = intdiv($date, 12);
    // $month = 1 + $date % 12;

    // ⚠️ CRITICAL FIX: 안전한 계산 (오버플로우 체크)
    let totalMonths: number;
    let year: number;
    let month: number;

    try {
      // PHP turnDate()와 동일: $date = startyear * 12 + num
      totalMonths = startyear * 12 + num;  // 1월을 0으로 계산 (PHP 호환)
      year = Math.floor(totalMonths / 12);
      month = 1 + (totalMonths % 12);

      // 추가 안전성 체크: year가 비정상적으로 크면 에러
      if (year > MAX_REASONABLE_YEAR || year < 0) {
        throw new Error(`Calculated year ${year} is out of reasonable range`);
      }
    } catch (error: any) {
      logger.error('CRITICAL: Year calculation overflow detected', { 
        error: error.message, 
        startyear, 
        num 
      });

      // 안전한 기본값으로 리셋
      gameEnv.starttime = curturn.toISOString();
      gameEnv.year = startyear;
      gameEnv.month = 1;

      return { year: startyear, month: 1, turn: 1 };
    }

    // 바뀐 경우만 업데이트
    if (gameEnv.month !== month || gameEnv.year !== year) {
      gameEnv.year = year;
      gameEnv.month = month;
    }

    return { year, month, turn: num + 1 }; // 턴은 1부터 시작
  }

  /**
   * 턴 시간 자르기 (turnterm 간격으로 정렬)
   * PHP cutTurn() 함수와 동일한 로직
   * 
   * PHP 버전:
   * - 어제 날짜의 01:00:00을 기준점으로 설정
   * - 현재 시간과의 차이(분)를 계산
   * - 차이를 turnterm으로 나눈 나머지를 제거
   * - 기준점에 조정된 분을 더함
   * 
   * @param time 자를 시간 (Date 객체 또는 문자열)
   * @param turntermInMinutes 턴 간격 (분 단위)
   * @returns 턴 경계로 자른 시간
   */
  public static cutTurn(time: Date | string, turntermInMinutes: number): Date {
    const date = time instanceof Date ? time : new Date(time);

    // PHP: $baseDate = new \DateTime($date->format('Y-m-d'));
    //      $baseDate->sub(new \DateInterval("P1D")); // 어제
    //      $baseDate->add(new \DateInterval("PT1H")); // 01:00:00
    const baseDate = new Date(date);
    baseDate.setHours(0, 0, 0, 0); // 오늘 00:00:00
    baseDate.setDate(baseDate.getDate() - 1); // 어제
    baseDate.setHours(1, 0, 0, 0); // 어제 01:00:00

    // PHP: $diffMin = intdiv($date->getTimeStamp() - $baseDate->getTimeStamp(), 60);
    //      $diffMin -= $diffMin % $turnterm;
    const diffMs = date.getTime() - baseDate.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const adjustedMinutes = diffMinutes - (diffMinutes % turntermInMinutes);

    // PHP: $baseDate->add(new \DateInterval("PT{$diffMin}M"));
    const result = new Date(baseDate);
    result.setMinutes(result.getMinutes() + adjustedMinutes);

    return result;
  }

  /**
   * 턴 시간 더하기
   * PHP addTurn() 함수와 동일한 로직
   * 
   * PHP 버전:
   * - turnterm(분) * turn(턴 수) 만큼 시간을 더함
   * 
   * @param time 기준 시간 (Date 객체 또는 문자열)
   * @param turntermInMinutes 턴 간격 (분 단위)
   * @param turnCount 더할 턴 수 (기본 1)
   * @returns 턴을 더한 시간
   */
  public static addTurn(time: Date | string, turntermInMinutes: number, turnCount: number = 1): Date {
    const date = time instanceof Date ? time : new Date(time);
    const result = new Date(date);
    // PHP: $target = $turnterm * $turn; $date->add(new \DateInterval("PT{$target}M"));
    result.setMinutes(result.getMinutes() + (turntermInMinutes * turnCount));
    return result;
  }

  /**
   * 턴타임을 turnterm 단위로 자르기 (PHP cutTurn 구현)
   * 예: turnterm=60이면 시간을 정각으로 맞춤
   */
  public static cutTurn(time: Date | string, turntermInMinutes: number): Date {
    const date = time instanceof Date ? time : new Date(time);
    const result = new Date(date);

    // turnterm 단위로 자르기
    const minutes = result.getMinutes();
    const cutMinutes = Math.floor(minutes / turntermInMinutes) * turntermInMinutes;
    result.setMinutes(cutMinutes);
    result.setSeconds(0);
    result.setMilliseconds(0);

    return result;
  }

  /**
   * 장수 액션 로그 추가
   * PHP의 general_record 테이블과 호환되도록 GeneralRecord 모델 사용
   */
  private static async pushGeneralActionLog(
    sessionId: string,
    generalId: number,
    message: string,
    year: number,
    month: number
  ) {
    try {
      const { GeneralRecord } = await import('../../models/general_record.model');

      const record = await GeneralRecord.create({
        session_id: sessionId,
        general_id: generalId,
        log_type: 'action',
        year: year,
        month: month,
        text: message,
        created_at: new Date()
      });

      // 웹소켓으로 실시간 브로드캐스트
      GameEventEmitter.broadcastLogUpdate(
        sessionId,
        generalId,
        'action',
        record.id || record._id,
        message
      );
    } catch (error: any) {
      logger.error('pushGeneralActionLog error', { 
        sessionId, 
        generalId, 
        error: error.message 
      });
    }
  }
}

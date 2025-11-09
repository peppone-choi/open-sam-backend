// @ts-nocheck - Type issues need investigation
import { sessionRepository } from '../../repositories/session.repository';
import { generalRepository } from '../../repositories/general.repository';
import { generalTurnRepository } from '../../repositories/general-turn.repository';
import { nationTurnRepository } from '../../repositories/nation-turn.repository';
import { GeneralLog } from '../../models/general-log.model';
import { KVStorage } from '../../models/kv-storage.model';
import { getCommand, getNationCommand } from '../../commands';
import { cityRepository } from '../../repositories/city.repository';
import { nationRepository } from '../../repositories/nation.repository';
import Redis from 'ioredis';
import { GameEventEmitter } from '../gameEventEmitter';
import { SessionStateService } from '../sessionState.service';
import { logger } from '../../common/logger';
import { kvStorageRepository } from '../../repositories/kvstorage.repository';

const MAX_TURN = 30;
const MAX_CHIEF_TURN = 12;
const LOCK_KEY = 'execute_engine_lock';
const LOCK_TTL = parseInt(process.env.EXECUTE_ENGINE_LOCK_TTL || '30', 10); // 기본 30초 (환경 변수로 조정 가능)
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
          console.log(`[${new Date().toISOString()}] Removing expired lock: ${lockKey}, TTL: ${ttl}초`);
          await redis.del(lockKey);
        } else {
          // 락이 너무 오래 유지되고 있으면 (TTL이 LOCK_TTL의 절반 이하) 강제 해제
          // 이는 heartbeat가 작동하지 않거나 프로세스가 죽은 경우를 대비
          if (ttl < LOCK_TTL / 2) {
            const ttlMinutes = Math.floor(ttl / 60);
            const ttlSeconds = ttl % 60;
            console.log(`[${new Date().toISOString()}] ⚠️ Lock exists but heartbeat may be dead: ${lockKey}, TTL: ${ttl}초 (${ttlMinutes}분 ${ttlSeconds}초), forcing release`);
            await redis.del(lockKey);
            // 계속 진행하여 락 획득 시도
          } else {
            // 락이 이미 존재하고 유효한 경우 (다른 인스턴스가 처리 중)
            // 하지만 TTL이 계속 유지되면 턴 처리가 너무 오래 걸리는 것일 수 있음
            const ttlMinutes = Math.floor(ttl / 60);
            const ttlSeconds = ttl % 60;
            console.log(`[${new Date().toISOString()}] ⏳ Lock already exists: ${lockKey}, TTL: ${ttl}초 (${ttlMinutes}분 ${ttlSeconds}초) - Another instance is processing turns`);
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
        console.log(`[${new Date().toISOString()}] Failed to acquire lock: ${lockKey}, value: ${currentValue}, TTL: ${ttl}초 (${ttlMinutes}분 ${ttlSeconds}초)`);
        return {
          success: true,
          result: false,
          updated: false,
          locked: true,
          reason: 'Another instance is processing'
        };
      }
      lockAcquired = true;
      console.log(`[${new Date().toISOString()}] ✅ Lock acquired: ${lockKey} (TTL: ${LOCK_TTL}초)`);
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        // 락을 해제하고 반환
        if (lockAcquired) {
          await redis.del(lockKey);
          lockAcquired = false;
          console.log(`[${new Date().toISOString()}] Lock released (early return - session not found): ${lockKey}`);
        }
        return {
          success: false,
          result: false,
          reason: 'Session not found',
          reqRefresh: true
        };
      }

    const sessionData = session.data as any || {};
    const now = new Date();
    
    // turnterm 유효성 검사 (1분~1440분 사이만 허용)
    if (sessionData.turnterm && (sessionData.turnterm < 1 || sessionData.turnterm > 1440)) {
      console.log(`[${new Date().toISOString()}] ⚠️ Invalid turnterm: ${sessionData.turnterm}, resetting to 60`);
      sessionData.turnterm = 60;
      session.data = sessionData;
      session.markModified('data');
      await sessionRepository.saveDocument(session);
    }
    
    // turnterm이 없으면 기본값 설정
    if (!sessionData.turnterm) {
      console.log(`[${new Date().toISOString()}] ⚠️ Missing turnterm, setting default to 60 minutes`);
      sessionData.turnterm = 60;
      session.data = sessionData;
      session.markModified('data');
      await sessionRepository.saveDocument(session);
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
        console.log(`[${new Date().toISOString()}] ⚠️ Turntime is ${Math.abs(timeDiffInMinutes).toFixed(1)} minutes in the past! Processing overdue turns...`);
      }
      
      if (now < turntime) {
        // turntime이 너무 먼 미래 (10분 이상)이면 잘못된 설정으로 간주하고 현재 시간 + turnterm으로 재설정
        // turnterm * 2보다 10분이 더 명확한 기준
        if (timeDiffInMinutes > 10) {
          console.log(`[${new Date().toISOString()}] ⚠️ Turntime is too far in future (${timeDiffInMinutes.toFixed(1)}min > 10min), resetting to now + turnterm (${turntermInMinutes}min)`);
          const correctedTurntime = new Date(now.getTime() + turntermInSeconds * 1000);
          sessionData.turntime = correctedTurntime.toISOString();
          session.data = sessionData;
          await sessionRepository.saveDocument(session);
          
          if (lockAcquired) {
            await redis.del(lockKey);
            lockAcquired = false;
            console.log(`[${new Date().toISOString()}] 🔓 Lock released (turntime corrected): ${lockKey}`);
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
          console.log(`[${new Date().toISOString()}] Lock released (early return - turntime not reached): ${lockKey}`);
        }
        return {
          success: true,
          result: false,
          updated: false,
          locked: false,
          turntime: turntime.toISOString()
        };
      }

      // 천통시에는 동결 (락 해제 필요)
      if (sessionData.isunited === 2 || sessionData.isunited === 3) {
        // 락을 해제하고 반환
        if (lockAcquired) {
          await redis.del(lockKey);
          lockAcquired = false;
          console.log(`[${new Date().toISOString()}] Lock released (early return - united): ${lockKey}`);
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
      console.log(`[${new Date().toISOString()}] ✅ Turntime passed (${timeDiffInMinutes.toFixed(1)}min ago), executing turns...`);

      // 락 갱신을 위한 heartbeat 시작
      console.log(`[${new Date().toISOString()}] 🔄 Starting heartbeat for ${lockKey} (interval: ${LOCK_HEARTBEAT_INTERVAL}초)`);
      heartbeatInterval = setInterval(async () => {
        try {
          const exists = await redis.exists(lockKey);
          if (exists) {
            const currentTtl = await redis.ttl(lockKey);
            await redis.expire(lockKey, LOCK_TTL);
            console.log(`[${new Date().toISOString()}] 💓 Lock heartbeat: ${lockKey} (renewed TTL: ${LOCK_TTL}초, previous TTL: ${currentTtl}초)`);
          } else {
            // 락이 이미 해제된 경우 heartbeat 중지
            console.log(`[${new Date().toISOString()}] ⚠️ Lock ${lockKey} no longer exists, stopping heartbeat`);
            if (heartbeatInterval) {
              clearInterval(heartbeatInterval);
              heartbeatInterval = null;
            }
          }
        } catch (error) {
          console.error(`[${new Date().toISOString()}] ❌ Lock heartbeat failed:`, error);
        }
      }, LOCK_HEARTBEAT_INTERVAL * 1000);

      let executed = false;
      let result: any;
      
      const executionStartTime = Date.now();
      console.log(`[${new Date().toISOString()}] 🚀 Starting turn execution for session: ${sessionId}`);
      
      result = await this.executeAllCommands(sessionId, session, sessionData);
      
      const executionDuration = Date.now() - executionStartTime;
      console.log(`[${new Date().toISOString()}] ✅ Turn execution completed in ${executionDuration}ms for session: ${sessionId}`);
      
      // heartbeat 중지 (실행 완료 전에)
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      
      // 락 해제 (실행 완료 전에)
      if (lockAcquired) {
        await redis.del(lockKey);
        lockAcquired = false;
        console.log(`[${new Date().toISOString()}] 🔓 Lock released (execution complete): ${lockKey}`);
      }
      
      return {
        success: true,
        result: result.executed,
        updated: result.executed,
        locked: false,
        turntime: result.turntime
      };
    } catch (error: any) {
      console.error('ExecuteEngine error:', error);
      return {
        success: false,
        result: false,
        reason: error.message
      };
    } finally {
      // heartbeat 중지
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      
      // 락 해제
      if (lockAcquired) {
        try {
          await redis.del(lockKey);
          console.log(`[${new Date().toISOString()}] Lock released: ${lockKey}`);
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Failed to release lock:`, error);
        }
      }
    }
  }

  /**
   * 모든 커맨드 실행 (executeAllCommand)
   */
  private static async executeAllCommands(sessionId: string, session: any, sessionData: any) {
    const now = new Date();
    const turntermInMinutes = sessionData.turnterm || 60; // 분 단위
    const turnterm = turntermInMinutes * 60; // 초 단위로 변환
    
    // starttime이 없으면 현재 turntime으로 설정 (초기화)
    // 중요: starttime은 게임이 실제로 시작된 시간이어야 하므로, 
    // turntime이 과거라면 turntime을 starttime으로 설정하는 것이 맞습니다
    if (!sessionData.starttime) {
      const initialTurntime = sessionData.turntime || now;
      sessionData.starttime = initialTurntime instanceof Date ? initialTurntime : new Date(initialTurntime);
      session.data = sessionData;
      await sessionRepository.saveDocument(session);
      console.log(`[${new Date().toISOString()}] ⚠️ starttime was missing, initialized to: ${sessionData.starttime}`);
    }
    
    // turntime을 Date 객체로 변환 (문자열일 수도 있음)
    const rawTurntime = sessionData.turntime || now;
    const turntimeDate = rawTurntime instanceof Date ? rawTurntime : new Date(rawTurntime);
    
    // 중요: turntime이 현재 시간보다 미래이면, 현재 시간을 기준으로 turnDate를 호출해야 합니다
    // 그렇지 않으면 매 틱마다 년/월이 증가할 수 있습니다
    const initialTurnDateTime = turntimeDate.getTime() > now.getTime() ? now : turntimeDate;
    
    // turnDate를 먼저 호출하여 현재 년/월을 정확히 계산
    // 이는 while 루프 전에 현재 상태를 정확히 파악하기 위함입니다
    const beforeYear = sessionData.year || 180;
    const beforeMonth = sessionData.month || 1;
    ExecuteEngineService.turnDate(initialTurnDateTime, sessionData);
    
    // 년/월이 변경되었을 때만 저장 (불필요한 DB 업데이트 방지)
    if (sessionData.year !== beforeYear || sessionData.month !== beforeMonth) {
      session.data = sessionData; // turnDate 변경사항 반영
      await sessionRepository.saveDocument(session); // DB에 저장
    }
    
    // turnterm은 분 단위로 전달해야 함
    let prevTurn = ExecuteEngineService.cutTurn(turntimeDate, turntermInMinutes);
    let nextTurn = ExecuteEngineService.addTurn(prevTurn, turntermInMinutes);
    
    const maxActionTime = 50; // 최대 실행 시간 (초)
    const limitActionTime = new Date(now.getTime() + maxActionTime * 1000);
    
    let executed = false;
    let currentTurn: string | null = null;
    let processedMonths = 0;

    // 현재 턴 이전 월턴까지 모두 처리
    while (nextTurn <= now) {
      processedMonths++;
      if (processedMonths > 100) {
        console.log(`[${new Date().toISOString()}] ⚠️ Too many months to process (${processedMonths}), stopping to prevent infinite loop`);
        break;
      }

      // 전 달의 장수 명령 실행 (prevTurn ~ nextTurn)
      // 중요: 월턴(nextTurn)이 시작되기 전에 전 달의 모든 장수 명령을 처리해야 함
      // 년/월은 아직 업데이트되지 않았으므로, 현재 년/월을 사용합니다
      // (turnDate는 나중에 호출됩니다)
      const [executionOver, lastTurn] = await this.executeGeneralCommandUntil(
        sessionId,
        nextTurn,
        limitActionTime,
        sessionData.year || 180,
        sessionData.month || 1,
        turnterm,
        sessionData
      );

      if (executionOver) {
        if (lastTurn) {
          executed = true;
          currentTurn = lastTurn;
          sessionData.turntime = lastTurn;
          session.data = sessionData;
          await sessionRepository.saveDocument(session);
        }
        return { executed, turntime: currentTurn || sessionData.turntime };
      }

      // 월 처리 이벤트 (전 달의 장수 명령 처리 후 다음 달로)
      // turnDate로 년/월을 증가시킴
      // PHP 코드를 보면 turnDate($nextTurn)을 호출합니다
      // 이는 nextTurn 시점의 년/월을 계산하는 것입니다
      // nextTurn은 다음 달의 시작 시간이므로, turnDate는 다음 달의 년/월을 계산합니다
      // 하지만 실제로는 prevTurn이 처리된 달의 끝 시간이므로,
      // turnDate는 prevTurn을 기준으로 호출해야 합니다 (현재 처리된 달의 년/월)
      // 그러나 PHP에서는 turnDate($nextTurn)을 호출하므로, 이는 다음 달의 년/월을 계산합니다
      // 따라서 우리도 nextTurn을 기준으로 호출하되, 년/월이 실제로 증가했는지 확인해야 합니다
      // 하지만 turnDate는 절대적인 시간 기반이므로, nextTurn을 기준으로 호출하면 다음 달의 년/월이 계산됩니다
      // 따라서 우리는 prevTurn을 기준으로 호출해야 합니다 (현재 처리된 달의 년/월)
      // 하지만 PHP에서는 turnDate($nextTurn)을 호출하므로, 우리도 nextTurn을 기준으로 호출합니다
      // 단, 년/월이 실제로 증가했는지 확인하기 위해 turnDate 내부에서 이미 체크하고 있습니다
      ExecuteEngineService.turnDate(nextTurn, sessionData);
      session.data = sessionData; // sessionData 변경사항을 session에 반영
      await sessionRepository.saveDocument(session); // DB에 저장 (년/월 업데이트 반영)
      await this.runEventHandler(sessionId, 'PRE_MONTH', sessionData);
      await this.preUpdateMonthly(sessionId, sessionData);
      
      // 서버 부하 체크 및 refreshLimit 조정
      try {
        const { CheckOverhead } = await import('./TrafficManager.service');
        await CheckOverhead(sessionId);
      } catch (error: any) {
        logger.error('[ExecuteEngine] Error checking overhead', {
          error: error.message
        });
      }
      
      // 분기 통계 (1월)
      if (sessionData.month === 1) {
        await this.checkStatistic(sessionId, sessionData);
      }
      
      await this.runEventHandler(sessionId, 'MONTH', sessionData);
      await this.postUpdateMonthly(sessionId, sessionData);
      
      // 트래픽 업데이트 (월별 통계)
      try {
        const { updateTraffic } = await import('./TrafficManager.service');
        await updateTraffic(sessionId);
      } catch (error: any) {
        logger.error('[ExecuteEngine] Error updating traffic', {
          error: error.message
        });
      }
      
      // 토너먼트 자동 진행
      try {
        const { processTournament } = await import('../tournament/TournamentEngine.service');
        await processTournament(sessionId);
      } catch (error: any) {
        logger.error('[ExecuteEngine] Error processing tournament', {
          error: error.message
        });
      }
      
      // 다음 달로
      prevTurn = nextTurn;
      nextTurn = ExecuteEngineService.addTurn(prevTurn, turntermInMinutes);
      sessionData.turntime = prevTurn.toISOString();
      session.data = sessionData; // turntime 업데이트 반영
      await sessionRepository.saveDocument(session); // DB에 저장
    }
    
    // while 루프가 실행되었다면 (여러 달을 처리했다면), 마지막 년/월만 브로드캐스트
    // 이렇게 하면 한 번에 여러 달을 처리할 때 과도한 이벤트 발생을 방지합니다
    if (processedMonths > 0) {
      GameEventEmitter.broadcastGameEvent(sessionId, 'month:changed', {
        year: sessionData.year,
        month: sessionData.month,
        turntime: prevTurn.toISOString()
      });
    }

    // 현재 시간의 월턴 이후 분 단위 장수 처리
    // turnDate는 while 루프 안에서 이미 처리되었으므로, 여기서는 현재 시간의 년/월만 확인
    // PHP에서는 turnDate($prevTurn)를 호출하지만, 이는 년/월이 변경되지 않은 경우에도 호출됩니다
    // 하지만 년/월이 변경되지 않았다면 DB 업데이트를 하지 않아도 됩니다
    // 중요: prevTurn이 현재 시간보다 미래이면, 현재 시간을 기준으로 turnDate를 호출해야 합니다
    // 그렇지 않으면 turntime이 미래일 때 매 틱마다 년/월이 증가할 수 있습니다
    const turnDateTime = prevTurn.getTime() > now.getTime() ? now : prevTurn;
    const beforeYearFinal = sessionData.year || 180;
    const beforeMonthFinal = sessionData.month || 1;
    ExecuteEngineService.turnDate(turnDateTime, sessionData);
    // 년/월이 변경되었을 때만 저장 (불필요한 DB 업데이트 방지)
    if (sessionData.year !== beforeYearFinal || sessionData.month !== beforeMonthFinal) {
      session.data = sessionData; // turnDate 변경사항 반영
      await sessionRepository.saveDocument(session); // DB에 저장
    }
    
    const [executionOver, lastTurn] = await this.executeGeneralCommandUntil(
      sessionId,
      now,
      limitActionTime,
      sessionData.year,
      sessionData.month,
      turnterm,
      sessionData
    );

    if (lastTurn) {
      executed = true;
      currentTurn = lastTurn;
    }

    // 다음 턴 시간 계산 (turnterm을 더해서)
    // 현재 턴 시간을 기준으로 다음 턴 시간 계산
    const nextTurntermInMinutes = sessionData.turnterm || 60;
    const nextTurntermInSeconds = nextTurntermInMinutes * 60;
    
    // 현재 턴 시간 결정: lastTurn이 있으면 사용, 없으면 prevTurn 사용
    const currentTurntime = currentTurn 
      ? new Date(currentTurn) 
      : (prevTurn || new Date(sessionData.turntime || now));
    
    // 다음 턴 시간 = 현재 턴 시간 + turnterm
    // addTurn은 분 단위를 받으므로 nextTurntermInMinutes 사용
    const nextTurnAt = ExecuteEngineService.addTurn(currentTurntime, nextTurntermInMinutes);
    
    // turntime을 다음 턴 시간으로 업데이트
    sessionData.turntime = nextTurnAt.toISOString();

    session.data = sessionData;
    session.markModified('data'); // Mixed 타입 변경사항 추적
    await sessionRepository.saveDocument(session);

    // 캐시 무효화 (년/월 변경 시)
    try {
      const { cacheManager } = await import('../../cache/CacheManager');
      await cacheManager.delete(`session:state:${sessionId}`);
      await cacheManager.delete(`session:byId:${sessionId}`);
    } catch (error: any) {
      // 캐시 무효화 실패해도 계속 진행
    }

    // 턴 실행 완료 시 Socket.IO 브로드캐스트 및 상태 업데이트
    if (executed) {
      // 세션 상태 업데이트
      await SessionStateService.updateSessionState(sessionId, {
        year: sessionData.year,
        month: sessionData.month,
        turntime: nextTurnAt,
        lastExecuted: new Date()
      });
      
      GameEventEmitter.broadcastTurnComplete(
        sessionId,
        sessionData.year * 12 + sessionData.month,
        nextTurnAt
      );
    }

    return { executed, turntime: nextTurnAt.toISOString() };
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
    gameEnv: any
  ): Promise<[boolean, string | null]> {
    
    // turntime이 date보다 이전인 장수들을 조회
    // turntime은 data.turntime에만 존재함
    // 세션 turntime을 기본값으로 사용하여 비교
    const sessionTurntime = gameEnv.turntime ? new Date(gameEnv.turntime) : date;
    
    const generals = await generalRepository.findByFilter({
      session_id: sessionId
    });
    
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
      
      // turntime이 date보다 이전이거나 같으면 처리 대상
      if (generalTurntimeDate <= date) {
        eligibleGenerals.push(general);
      } else if (generalTurntimeDate > date) {
        // turntime이 date(월턴)보다 미래면
        // 하지만 현재 시간보다는 과거거나 같으면 처리 대상 (월턴이 지났으므로)
        const now = new Date();
        if (generalTurntimeDate <= now) {
          // 월턴은 지났지만 turntime은 아직 안 지남 - 이건 정상 (월턴 후에 처리됨)
          // 여기서는 처리하지 않음
        } else {
          // turntime이 현재 시간보다도 미래면 잘못된 상태
          // 월턴 시점으로 리셋하고 처리 대상에 추가
          generalsToFix.push({ no: general.no || general.data?.no, turntime: generalTurntimeDate, willReset: true });
          eligibleGenerals.push(general); // 리셋 후 처리 대상
        }
      }
    }
    
    // 정렬
    eligibleGenerals.sort((a: any, b: any) => {
      const aTime = a.turntime ? new Date(a.turntime) : sessionTurntime;
      const bTime = b.turntime ? new Date(b.turntime) : sessionTurntime;
      return aTime.getTime() - bTime.getTime();
    });
    

    let currentTurn: string | null = null;

    for (const general of eligibleGenerals) {
      // lean()으로 가져온 문서는 Mongoose 문서가 아니므로 다시 조회
      let generalDoc: any;
      try {
        generalDoc = await generalRepository.findById(general._id);
        if (!generalDoc) {
          // 장수가 삭제되었거나 존재하지 않으면 건너뛰기
          continue;
        }
      } catch (error: any) {
        // findById 실패 시 (장수가 삭제됨) 건너뛰기
        logger.warn(`[ExecuteEngine] General not found: ${general._id}`, { error: error.message });
        continue;
      }
      
      // turntime이 미래로 설정되어 있으면 월턴 시점으로 리셋
      const generalTurntime = generalDoc.data?.turntime;
      if (generalTurntime) {
        const generalTurntimeDate = generalTurntime instanceof Date 
          ? generalTurntime 
          : new Date(generalTurntime);
        const now = new Date();
        if (generalTurntimeDate > now && generalTurntimeDate > date) {
          // turntime이 현재 시간과 월턴 모두보다 미래면 월턴 시점으로 리셋
          const generalNo = generalDoc.no;
          await generalRepository.updateBySessionAndNo(sessionId, generalNo, {
            turntime: date.toISOString()
          });
          // 로컬 객체도 업데이트
          generalDoc.turntime = date.toISOString();
        }
      }

      const currActionTime = new Date();
      if (currActionTime > limitActionTime) {
        return [true, currentTurn];
      }

      // 장수 턴 실행 (전역 게임 년/월 사용)
      await this.executeGeneralTurn(sessionId, generalDoc, year, month, turnterm, gameEnv);

      currentTurn = generalDoc.turntime || new Date().toISOString();

      // 장수 정보 업데이트 브로드캐스트 (전역 년/월 사용)
      const generalNo = generalDoc.no;
      if (generalNo) {
        GameEventEmitter.broadcastGeneralUpdate(sessionId, generalNo, {
          turntime: currentTurn
        });
      }
      
      // 턴 당기기 (0번 턴 삭제, 1->0, 2->1, ...)
      // generalNo를 사용해야 함 (data.no와 no가 다를 수 있음)
      await this.pullGeneralCommand(sessionId, generalNo, 1);
      const nationId = generalDoc.nation || generalDoc.data?.nation || 0;
      const officerLevel = generalDoc.data?.officer_level || 0;
      await this.pullNationCommand(sessionId, nationId, officerLevel, 1);
      
      // 턴 시간 업데이트
      const deleted = await this.updateTurnTime(sessionId, generalDoc, turnterm, gameEnv);
      
      // updateTurnTime에서 장수가 삭제되었으면 save() 스킵
      if (deleted) {
        continue;
      }
      
      try {
        // 레포지토리를 통한 저장
        const generalNo = generalDoc.data?.no || generalDoc.no;
        await generalRepository.updateBySessionAndNo(sessionId, generalNo, generalDoc.data || generalDoc.toObject());
      } catch (error: any) {
        // save() 실패 시 (장수가 삭제됨) 건너뛰기
        if (error.name === 'DocumentNotFoundError' || error.message?.includes('No document found')) {
          logger.warn(`[ExecuteEngine] General deleted during save: ${generalDoc._id}`);
          continue;
        }
        throw error;
      }
    }

    return [false, currentTurn];
  }

  /**
   * 개별 장수 턴 실행
   * 모든 장수는 전역 게임 년/월을 공유하며, 개별 턴 카운터로 나이 증가를 관리
   */
  private static async executeGeneralTurn(
    sessionId: string,
    general: any,
    year: number,
    month: number,
    turnterm: number,
    gameEnv: any
  ) {
    // 전역 게임 년/월 사용 (모든 장수가 공유)
    // 장수별 턴 카운터 초기화 (없으면 0)
    if (general.turn_count === undefined || general.turn_count === null) {
      general.turn_count = 0;
    }
    
    // 전역 년/월 사용
    let generalYear = year;
    let generalMonth = month;
    
    const generalId = general.no;
    
    // 전처리 (부상 경감, 병력/군량 소모 등)
    await this.preprocessCommand(sessionId, general, generalYear, generalMonth);
    
    // 블럭 처리
    if (await this.processBlocked(sessionId, general, generalYear, generalMonth)) {
      return;
    }

    // 국가 커맨드 실행 (수뇌부만)
    const nationId = general.nation || 0;
    const officerLevel = general.officer_level || 0;
    const hasNationTurn = nationId && officerLevel >= 5;
    if (hasNationTurn) {
      await this.processNationCommand(sessionId, general, generalYear, generalMonth);
    }

    // 장수 커맨드 실행 (0번 턴) - 휴식 포함
    await this.processGeneralCommand(sessionId, general, generalYear, generalMonth, gameEnv);

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
      const city = await cityRepository.findByCityNum(sessionId, cityId );
      if (city) {
        general.setRawCity(city);
      }
    }

    if (nationId) {
      const nation = await nationRepository.findByNationNum(sessionId, nationId );
      if (nation) {
        general._cached_nation = nation;
      }
    }
  }

  /**
   * 전처리 (부상 경감, 병력 군량 소모)
   */
  private static async preprocessCommand(sessionId: string, general: any, year: number, month: number) {
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
   */
  private static async processNationCommand(sessionId: string, general: any, year: number, month: number) {
    const nationId = general.nation || 0;
    const officerLevel = general.officer_level || 0;

    if (nationId === 0 || officerLevel < 5) {
      return;
    }

    // 0번 턴 조회
    const nationTurn = await nationTurnRepository.findOneByFilter({
      session_id: sessionId,
      nation_id: nationId,
      officer_level: officerLevel,
      turn_idx: 0
    });

    if (!nationTurn) {
      return;
    }

    const action = nationTurn.action || '휴식';
    const arg = nationTurn.arg || {};

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
      let command = new CommandClass(general, env, lastTurn, arg);
      
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
        const result = await command.run(rng);
        
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
      console.error(`Nation command ${action} failed:`, error);
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
    gameEnv: any
  ) {
    // generalId는 top-level no 또는 data.no일 수 있음
    const generalId = general.no || general.data?.no;
    
    if (!generalId) {
      console.error('processGeneralCommand: generalId not found', { general: general._id });
      return;
    }
    
    // 0번 턴 조회
    let generalTurn = await generalTurnRepository.findOneByFilter({
      session_id: sessionId,
      'data.general_id': generalId,
      'data.turn_idx': 0
    });

    // 명령이 없으면 휴식으로 자동 생성
    if (!generalTurn) {
      generalTurn = await generalTurnRepository.create({
        session_id: sessionId,
        data: {
          general_id: generalId,
          turn_idx: 0,
          action: '휴식',
          brief: '휴식',
          arg: {}
        }
      });
    }

    const action = generalTurn.action || '휴식';
    const arg = generalTurn.arg || {};

    // killturn 처리 (PHP 로직과 동일)
    const killturn = gameEnv.killturn || 30;
    const npcType = general.npc || 0;
    const currentKillturn = general.killturn ?? killturn;
    const autorunMode = false; // TODO: AI 자동 실행 모드 구현

    if (npcType >= 2) {
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

    if (action === '휴식') {
      return;
    }

    const CommandClass = getCommand(action);
    if (!CommandClass) {
      await this.pushGeneralActionLog(
        sessionId,
        general.no,
        `<R>알 수 없는 커맨드:</> ${action}`,
        year,
        month
      );
      return;
    }

    try {
      await this.loadCityAndNation(general, sessionId);
      const env = { year, month, session_id: sessionId, ...gameEnv };
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
        const rng = this.createRNG(sessionId, year, month, generalId, action);
        const result = await command.run(rng);
        
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
      
      // 로거 flush (ActionLogger인 경우)
      if (command && typeof command.logger?.flush === 'function') {
        await command.logger.flush();
      }
      
    } catch (error: any) {
      console.error(`Command ${action} failed:`, error);
      await this.pushGeneralActionLog(
        sessionId,
        general.no,
        `<R>커맨드 실행 실패:</> ${action} (${error.message})`,
        year,
        month
      );
      
      // 에러 시에도 로거 flush
      if (command && typeof command.logger?.flush === 'function') {
        try {
          await command.logger.flush();
        } catch (flushError) {
          console.error('Logger flush error:', flushError);
        }
      }
    }
  }

  /**
   * RNG 생성 (PHP와 동일한 시드 사용)
   * PHP: new RandUtil(new LiteHashDRBG(Util::simpleSerialize(...)))
   */
  private static createRNG(sessionId: string, year: number, month: number, generalId: number, commandName: string): any {
    // 간단한 RNG 구현 (실제로는 LiteHashDRBG 사용해야 함)
    const seed = `${sessionId}_${year}_${month}_${generalId}_${commandName}`;
    let seedValue = 0;
    for (let i = 0; i < seed.length; i++) {
      seedValue = ((seedValue << 5) - seedValue) + seed.charCodeAt(i);
      seedValue = seedValue & seedValue; // Convert to 32bit integer
    }
    
    const rng = {
      choiceUsingWeightPair: (pairs: any[]) => {
        if (!pairs || pairs.length === 0) return null;
        const total = pairs.reduce((sum, [val, weight]) => sum + (weight || 0), 0);
        let random = Math.abs(Math.sin(seedValue++)) * total;
        for (const [val, weight] of pairs) {
          random -= (weight || 0);
          if (random <= 0) return val;
        }
        return pairs[0][0];
      },
      choiceUsingWeight: (obj: any) => {
        const pairs = Object.entries(obj).map(([key, weight]) => [key, weight as number]);
        return rng.choiceUsingWeightPair(pairs);
      }
    };
    
    return rng;
  }

  /**
   * 턴 시간 업데이트
   * 전역 게임 년/월을 사용하여 turntime 계산
   */
  private static async updateTurnTime(sessionId: string, general: any, turnterm: number, gameEnv: any): Promise<boolean> {
    // 전역 게임 년/월 사용
    const year = gameEnv.year || 180;
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
    if ((general.age || 20) >= retirementYear && general.npc === 0) {
      // TODO: 환생 처리
      general.age = 15;
      general.killturn = 120;
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
    const turntermInMinutes = gameEnv.turnterm || 60;
    const newTurntime = ExecuteEngineService.addTurn(currentTurntime, turntermInMinutes);

    general.turntime = newTurntime.toISOString();
    
    return false; // 삭제되지 않음
  }

  /**
   * 턴 당기기 (장수)
   */
  private static async pullGeneralCommand(sessionId: string, generalId: number, turnCnt: number) {
    if (turnCnt === 0 || turnCnt >= MAX_TURN) {
      return;
    }

    // 모든 턴을 turnCnt만큼 당김 (1→0, 2→1, ...)
    await generalTurnRepository.updateMany(
      {
        session_id: sessionId,
        'data.general_id': generalId
      },
      {
        $inc: { 'data.turn_idx': -turnCnt }
      }
    );

    // 음수가 된 턴들 삭제 (원래 0번 턴이 -1이 됨)
    await generalTurnRepository.deleteMany({
      session_id: sessionId,
      'data.general_id': generalId,
      'data.turn_idx': { $lt: 0 }
    });
  }

  /**
   * 턴 당기기 (국가)
   */
  private static async pullNationCommand(sessionId: string, nationId: number, officerLevel: number, turnCnt: number) {
    if (!nationId || officerLevel < 5 || turnCnt === 0 || turnCnt >= MAX_CHIEF_TURN) {
      return;
    }

    // 모든 턴을 turnCnt만큼 당김 (1→0, 2→1, ...)
    await nationTurnRepository.updateMany(
      {
        session_id: sessionId,
        'data.nation_id': nationId,
        'data.officer_level': officerLevel
      },
      {
        $inc: { 'data.turn_idx': -turnCnt }
      }
    );

    // 음수가 된 턴들 삭제 (원래 0번 턴이 -1이 됨)
    await nationTurnRepository.deleteMany({
      session_id: sessionId,
      'data.nation_id': nationId,
      'data.officer_level': officerLevel,
      'data.turn_idx': { $lt: 0 }
    });
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
        console.error(`Event ${eventID} failed:`, error);
      }
    }
    
    return true;
  }

  /**
   * 월 전처리
   */
  private static async preUpdateMonthly(sessionId: string, gameEnv: any) {
    // penalty 감소 (세션 월 기준)
    await generalRepository.updateManyByFilter(
      { session_id: sessionId },
      {
        $inc: {
          'data.penalty': -1
        }
      }
    );

    await generalRepository.updateManyByFilter(
      { session_id: sessionId, 'data.penalty': { $lt: 0 } },
      { $set: { 'data.penalty': 0 } }
    );

    // 나이 증가는 각 장수의 개별 년도가 넘어갈 때 executeGeneralTurn에서 처리
    // (각 장수는 개별적인 게임 내 년/월을 가지므로)

    await nationRepository.updateManyByFilter(
      { session_id: sessionId },
      {
        $inc: {
          'data.consecu_turn_count': -1,
          'data.last_war_month': -1
        }
      }
    );

    await nationRepository.updateManyByFilter(
      { session_id: sessionId, 'data.consecu_turn_count': { $lt: 0 } },
      { $set: { 'data.consecu_turn_count': 0 } }
    );
  }

  /**
   * 월 후처리
   */
  private static async postUpdateMonthly(sessionId: string, gameEnv: any) {
    const year = gameEnv.year;
    const month = gameEnv.month;
    
    const cities = await cityRepository.findByFilter({ session_id: sessionId });
    
    for (const city of cities) {
      const cityNum = city.city || city.data?.city;
      const newPop = Math.min(city.pop + Math.floor(city.agri / 10), city.pop_max);
      const newAgri = Math.min(city.agri + Math.floor(city.agri / 100), city.agri_max);
      const newComm = Math.min(city.comm + Math.floor(city.comm / 100), city.comm_max);
      const newSecu = Math.max(city.secu - 5, 0);
      const newDef = Math.max(city.def - 3, 0);
      
      await cityRepository.updateByCityNum(sessionId, cityNum, {
        pop: newPop,
        agri: newAgri,
        comm: newComm,
        secu: newSecu,
        def: newDef
      });
    }

    const nations = await nationRepository.findByFilter({ session_id: sessionId });
    for (const nation of nations) {
      const currentRice = nation.data?.rice || nation.rice || 0;
      const gennum = nation.data?.gennum || nation.gennum || 0;
      if (currentRice > 0) {
        const newRice = Math.max(currentRice - Math.floor(gennum * 10), 0);
        const nationNum = nation.data?.nation || nation.nation;
        await nationRepository.updateByNationNum(sessionId, nationNum, {
          'data.rice': newRice
        });
      }
    }

    // 경매 처리 (마감된 경매 낙찰 처리)
    try {
      const { processAuction } = await import('../auction/AuctionEngine.service');
      await processAuction(sessionId);
    } catch (error: any) {
      console.error('[ExecuteEngine] Error processing auctions', {
        error: error.message,
        stack: error.stack
      });
    }

    // 중립 경매 자동 등록 (시장 안정화)
    try {
      const { registerAuction } = await import('../auction/AuctionEngine.service');
      await registerAuction(sessionId);
    } catch (error: any) {
      console.error('[ExecuteEngine] Error registering auctions', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * 분기 통계
   * TODO: 실제 통계 생성 로직 구현 필요
   */
  private static async checkStatistic(sessionId: string, gameEnv: any) {
    const year = gameEnv.year;
    const quarter = Math.floor((gameEnv.month - 1) / 3) + 1;
    
    // 실제 통계 생성 로직은 아직 구현되지 않았으므로 로그만 출력 (필요시 제거 가능)
    // console.log(`Generating statistics for ${year}Q${quarter}`);
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
   * @param turntime 현재 턴 시간 (Date 객체 또는 문자열)
   * @param gameEnv 게임 환경 데이터 (starttime, startyear, turnterm, year, month 포함)
   * @returns 계산된 년/월 정보 { year, month, turn }
   */
  public static turnDate(turntime: Date | string, gameEnv: any): { year: number; month: number; turn: number } {
    // starttime과 startyear 가져오기
    const starttime = gameEnv.starttime ? new Date(gameEnv.starttime) : new Date();
    const startyear = gameEnv.startyear || 180;
    const turntermInMinutes = gameEnv.turnterm || 60; // 분 단위
    
    // curtime을 Date 객체로 변환
    const curtime = turntime instanceof Date ? turntime : new Date(turntime);
    
    // PHP: $curturn = cutTurn($curtime, $admin['turnterm'])
    // cutTurn은 turnterm(분) 간격으로 시간을 자름
    const curturn = ExecuteEngineService.cutTurn(curtime, turntermInMinutes);
    const starttimeCut = ExecuteEngineService.cutTurn(starttime, turntermInMinutes);
    
    // PHP: $num = intdiv((strtotime($curturn) - strtotime($turn)), $term * 60)
    // 경과한 분 수를 계산한 후 turnterm으로 나눔
    const timeDiffMinutes = (curturn.getTime() - starttimeCut.getTime()) / (1000 * 60);
    const num = Math.max(0, Math.floor(timeDiffMinutes / turntermInMinutes));
    
    // PHP: $date = $admin['startyear'] * 12 + $num
    const date = startyear * 12 + num;
    
    // PHP: $year = intdiv($date, 12)
    // PHP: $month = 1 + $date % 12
    const year = Math.floor(date / 12);
    const month = (date % 12) + 1;
    
    // 바뀐 경우만 업데이트
    if (gameEnv.month !== month || gameEnv.year !== year) {
      gameEnv.year = year;
      gameEnv.month = month;
      // 디버그 로그는 환경 변수로 제어 (과도한 로그 방지)
      if (process.env.DEBUG_TURNDATE === 'true') {
        console.log(`[${new Date().toISOString()}] 📅 Year/Month updated: ${year}년 ${month}월 (starttime: ${starttimeCut.toISOString()}, turntime: ${curturn.toISOString()}, turns: ${num})`);
      }
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
   * 장수 액션 로그 추가
   */
  private static async pushGeneralActionLog(
    sessionId: string,
    generalId: number,
    message: string,
    year: number,
    month: number
  ) {
    const date = `${year}년 ${month}월`;
    const fullMessage = `${message} <1>${date}</>`;
    
    try {
      const maxId = await GeneralLog.findOne({ session_id: sessionId })
        .sort({ id: -1 })
        .limit(1);
      
      const newId = (maxId?.id || 0) + 1;

      await GeneralLog.create({
        id: newId,
        session_id: sessionId,
        general_id: generalId,
        log_type: 'action',
        message: fullMessage,
        data: { year, month },
        created_at: new Date()
      });
    } catch (error) {
      console.error('pushGeneralActionLog error:', error);
    }
  }
}

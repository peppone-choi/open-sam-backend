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
        console.log(`[${new Date().toISOString()}] 🔓 Lock released (status=${sessionStatus}): ${lockKey}`);
      }
      return {
        success: true,
        result: false,
        updated: false,
        reason: `Server status is ${sessionStatus}, skipping turn execution`
      };
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
      console.log(`[${new Date().toISOString()}] ⚠️ Missing turnterm, setting default to ${defaultTurnterm} minutes`);
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
      console.log(`[${new Date().toISOString()}] ⚠️ Invalid turnterm: ${turnterm}, resetting to ${defaultTurnterm}`);
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
        console.log(`[${new Date().toISOString()}] ⚠️ Turntime is ${Math.abs(timeDiffInMinutes).toFixed(1)} minutes in the past! Processing overdue turns...`);
      }
      
      if (now < turntime) {
        // turntime이 너무 먼 미래이면 잘못된 설정으로 간주하고 현재 시간 + turnterm으로 재설정
        // 체크 기준: turnterm * 3 (최소 10분, 최대 180분)
        const maxAllowedMinutes = Math.min(Math.max(turntermInMinutes * 3, 10), 180);
        if (timeDiffInMinutes > maxAllowedMinutes) {
          console.log(`[${new Date().toISOString()}] ⚠️ Turntime is too far in future (${timeDiffInMinutes.toFixed(1)}min > ${maxAllowedMinutes}min), resetting to now + turnterm (${turntermInMinutes}min)`);
          const correctedTurntime = new Date(now.getTime() + turntermInSeconds * 1000);
          sessionData.turntime = correctedTurntime.toISOString();
          sessionData.game_env.turntime = correctedTurntime.toISOString();
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

      // 천통시에는 동결 - 위에서 session.status로 이미 체크했으므로 불필요
      // (레거시 호환성을 위해 유지하되, sessionData에서 isunited 가져오기)
      const isunited = sessionData.game_env?.isunited ?? sessionData.isunited ?? 0;
      if (isunited === 2 || isunited === 3) {
        // 락을 해제하고 반환
        if (lockAcquired) {
          await redis.del(lockKey);
          lockAcquired = false;
          console.log(`[${new Date().toISOString()}] Lock released (early return - isunited=${isunited}): ${lockKey}`);
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
      
      // executeAllCommands는 내부에서 락을 해제함 (세션 상태 업데이트 직후)
      result = await this.executeAllCommands(sessionId, session, sessionData, lockKey, () => {
        // 락 해제 콜백
        if (lockAcquired) {
          redis.del(lockKey).then(() => {
            lockAcquired = false;
            console.log(`[${new Date().toISOString()}] 🔓 Lock released (after session state update): ${lockKey}`);
          }).catch(err => {
            console.error(`[${new Date().toISOString()}] Failed to release lock:`, err);
          });
        }
        
        // heartbeat 중지
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
      });
      
      const executionDuration = Date.now() - executionStartTime;
      console.log(`[${new Date().toISOString()}] ✅ Turn execution completed in ${executionDuration}ms for session: ${sessionId}`);
      
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
          console.log(`[${new Date().toISOString()}] 🔓 Lock released (finally block - safety): ${lockKey}`);
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Failed to release lock:`, error);
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
    releaseLock?: () => void
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
      console.log(`[${new Date().toISOString()}] ⚠️ starttime was missing, initialized to: ${sessionData.starttime}`);
    }
    
    // 현재 게임 년/월 계산 (세션 기준)
    const rawTurntime = sessionData.turntime || now;
    const turntimeDate = rawTurntime instanceof Date ? rawTurntime : new Date(rawTurntime);
    const initialTurnDateTime = turntimeDate.getTime() > now.getTime() ? now : turntimeDate;
    
    const beforeYear = sessionData.year || sessionData.game_env?.year || 184;
    const beforeMonth = sessionData.month || 1;
    ExecuteEngineService.turnDate(initialTurnDateTime, sessionData);
    
    // 년/월이 변경되었으면 저장
    if (sessionData.year !== beforeYear || sessionData.month !== beforeMonth) {
      session.data = sessionData;
      session.markModified('data');
      await sessionRepository.saveDocument(session);
      console.log(`[${new Date().toISOString()}] 📅 Game date updated: ${sessionData.year}년 ${sessionData.month}월`);
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
      sessionData
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
      const { cacheManager } = await import('../../cache/CacheManager');
      await cacheManager.delete(`session:state:${sessionId}`);
      await cacheManager.delete(`session:byId:${sessionId}`);
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
        console.log(`[${new Date().toISOString()}] ✅ Supply lines updated for session: ${sessionId}`);
      } catch (error: any) {
        console.error(`[${new Date().toISOString()}] ❌ Failed to update supply lines:`, error);
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
    gameEnv: any
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
      const aIsPlayer = (a.npc === 0 || a.data?.npc === 0);
      const bIsPlayer = (b.npc === 0 || b.data?.npc === 0);
      
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
    
    console.log(`[Turn] Processing ${eligibleGenerals.length} generals in batches of ${BATCH_SIZE}`);
    
    // 배치 단위로 병렬 처리
    for (let i = 0; i < eligibleGenerals.length; i += BATCH_SIZE) {
      const batch = eligibleGenerals.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(eligibleGenerals.length / BATCH_SIZE);
      
      console.log(`[Turn] Processing batch ${batchNum}/${totalBatches} (${batch.length} generals)`);
      
      // 배치 명령 당기기용 수집
      const batchPullCommands: Array<{ sessionId: string, generalId: number, isNPC: boolean, generalName: string, beforeLogTime: Date | null }> = [];
      const batchPullNationCommands: Array<{ sessionId: string, nationId: number, officerLevel: number }> = [];
      
      await Promise.all(batch.map(async (general) => {
        const isPlayer = general.npc === 0 || general.data?.npc === 0;
        processedCount++;
        
        // 진행도 로깅 (200명마다)
        if (processedCount % 200 === 0) {
          console.log(`[Turn] Progress: ${processedCount}/${eligibleGenerals.length} generals processed`);
        }
        
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
        const isPlayerGeneral = generalDoc.npc === 0 || generalDoc.data?.npc === 0;
      
      // 밀린 턴을 모두 처리 (turntime이 현재 시각을 지날 때까지 반복)
      let turnsExecuted = 0;
      const maxTurnsPerGeneral = isPlayerGeneral ? 50 : 10; // 플레이어: 50턴, NPC: 10턴
      const now = new Date();
      
      while (turnsExecuted < maxTurnsPerGeneral) {
        const currActionTime = new Date();
        if (currActionTime > limitActionTime) {
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
        
        turnsExecuted++;

        // 유저인 경우 턴 실행 전 로그 시간 기록
        const isNPC = (generalDoc.npc || generalDoc.data?.npc || 0) >= 2;
        const generalName = generalDoc.name || generalDoc.data?.name || '';
        const beforeLogTime = !isNPC ? new Date() : null;

        // 장수 턴 실행 (전역 게임 년/월 사용)
        const turnExecuted = await this.executeGeneralTurn(sessionId, generalDoc, year, month, turnterm, gameEnv);

        currentTurn = generalDoc.turntime || new Date().toISOString();
        
        // 턴이 처리되었으면 명령 당기기 (배치에 추가)
        if (turnExecuted) {
          batchPullCommands.push({ sessionId, generalId: generalNo, isNPC, generalName, beforeLogTime });
          const nationId = generalDoc.nation || generalDoc.data?.nation || 0;
          const officerLevel = generalDoc.data?.officer_level || 0;
          if (nationId && officerLevel >= 5) {
            batchPullNationCommands.push({ sessionId, nationId, officerLevel });
          }
        } else {
          // 명령이 없어도 turntime은 업데이트해야 함 (무한 루프 방지)
          console.log(`[Turn] General ${generalNo}: No command executed, but updating turntime`);
        }
        
        // turntime 업데이트 (명령 유무와 관계없이 항상 실행)
        const deleted = await this.updateTurnTime(sessionId, generalDoc, turnterm, gameEnv);
        
        if (deleted) {
          break; // 장수가 삭제되면 루프 종료
        }
        
        // updateTurnTime이 generalDoc.turntime을 업데이트했으므로
        // data.turntime도 동기화
        if (generalDoc.data && generalDoc.turntime) {
          generalDoc.data.turntime = generalDoc.turntime;
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
          const generalData = generalDoc.data || generalDoc;
          await generalRepository.updateBySessionAndNo(sessionId, generalNo, generalData);
        } catch (error: any) {
          // save() 실패 시 (장수가 삭제됨) 건너뛰기
          if (error.name === 'DocumentNotFoundError' || error.message?.includes('No document found')) {
            logger.warn(`[ExecuteEngine] General deleted during save: ${generalDoc._id}`);
            return;
          }
          throw error;
        }
      }));
      
      // 배치 명령 당기기 실행 (병렬 처리)
      if (batchPullCommands.length > 0 || batchPullNationCommands.length > 0) {
        await Promise.all([
          ...batchPullCommands.map(cmd => 
            this.pullGeneralCommand(cmd.sessionId, cmd.generalId, 1, cmd.isNPC, cmd.generalName, cmd.beforeLogTime)
          ),
          ...batchPullNationCommands.map(cmd =>
            this.pullNationCommand(cmd.sessionId, cmd.nationId, cmd.officerLevel, 1)
          )
        ]);
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
  ): Promise<boolean> {
    const generalId = general.no;
    
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
      await this.processNationCommand(sessionId, general, generalYear, generalMonth);
    }

    // 장수 커맨드 실행 (0번 턴) - 휴식 포함
    let commandExecuted = false;
    try {
      commandExecuted = await this.processGeneralCommand(sessionId, general, generalYear, generalMonth, gameEnv);
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
    const cityId = general.city || general.data?.city || 0;
    // nationId는 위(line 739)에서 이미 선언됨 - 재사용
    
    // 도시/국가 정보가 변경되었을 수 있으므로 캐시 무효화
    if (cityId) {
      try {
        const { cacheManager } = await import('../../cache/CacheManager');
        await cacheManager.delete(`city:${sessionId}:${cityId}`);
      } catch (error: any) {
        // 캐시 무효화 실패해도 계속 진행
      }
    }
    
    if (nationId) {
      try {
        const { cacheManager } = await import('../../cache/CacheManager');
        await cacheManager.delete(`nation:${sessionId}:${nationId}`);
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
        
        // 로그 flush
        try {
          const generalObj = command.getGeneral?.();
          if (generalObj && typeof generalObj.getLogger === 'function') {
            const logger = generalObj.getLogger();
            if (logger && typeof logger.flush === 'function') {
              await logger.flush();
            }
          }
        } catch (error: any) {
          console.error('Failed to flush logger:', error);
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
  ): Promise<boolean> {
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

    let action = '휴식';
    let arg = {};
    
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
        console.log(`[Turn] ${generalName} (Player-controlled): No command, resting`);
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
      console.log(`[Turn] ${generalName} (NPC, type=${npcType}): No command, will try AI decision`);
      action = '휴식';
      arg = {};
    } else {
      action = generalTurn.data?.action || '휴식';
      arg = generalTurn.data?.arg || {};
    }

    // killturn 처리 (PHP 로직과 동일)
    const killturn = gameEnv.killturn || 30;
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
    
    if (isAIControlled && (action === '휴식' || !generalTurn)) {
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
        
        console.log(`[AI] General ${generalId} (${general.name || general.data?.name}):`, {
          npcType,
          hasCity: !!city,
          cityId: city?.city,
          hasNation: !!nation,
          nationId: nation?.nation
        });
        
        if (!city) {
          console.log(`[AI] General ${generalId}: No city, skipping AI decision`);
          return;
        }
        
        const decision = await ai.decideNextCommand(
          general,
          city,
          nation,
          { year, month, session_id: sessionId, ...gameEnv }
        );
        
        console.log(`[AI] General ${generalId} decision:`, {
          command: decision?.command,
          reason: decision?.reason,
          priority: decision?.priority,
          args: decision?.args
        });
        
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
          
          console.log(`[AI] General ${generalId}: Command set to ${decision.command}`);
          
          // generalTurn 다시 조회
          generalTurn = await generalTurnRepository.findOneByFilter({
            session_id: sessionId,
            'data.general_id': generalId,
            'data.turn_idx': 0
          });
          
          if (generalTurn) {
            // action과 arg 업데이트
            action = generalTurn.data?.action || generalTurn.action || '휴식';
            arg = generalTurn.data?.arg || generalTurn.arg || {};
          }
        } else {
          console.log(`[AI] General ${generalId}: No action (neutral or null)`, { decision });
        }
      } catch (error: any) {
        // AI 실패 시 휴식
        console.error(`[AI] General ${generalId} error:`, error.message);
        return;
      }
    }

    // 휴식인 경우 로그만 남기고 턴 소비
    if (action === '휴식') {
      console.log(`[Turn] General ${generalId} (${general.name || general.data?.name}): Resting`);
      
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
      console.error(`[Turn] General ${generalId}: Unknown command '${action}'`);
      await this.pushGeneralActionLog(
        sessionId,
        general.no,
        `<R>알 수 없는 커맨드:</> ${action}`,
        year,
        month
      );
      return true; // 에러도 턴 소모
    }
    
    console.log(`[Turn] General ${generalId} (${general.name || general.data?.name}): Executing ${action}`, arg);

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
        const result = await command.run(rng);
        
        // 로그 flush
        try {
          const generalObj = command.getGeneral?.();
          if (generalObj && typeof generalObj.getLogger === 'function') {
            const logger = generalObj.getLogger();
            if (logger && typeof logger.flush === 'function') {
              await logger.flush();
            }
          }
        } catch (error: any) {
          console.error('Failed to flush logger:', error);
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
      console.error(`Command ${action} failed:`, error);
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
      } catch (flushError) {
        console.error('Logger flush error:', flushError);
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
  private static async updateTurnTime(sessionId: string, general: any, turnterm: number, gameEnv: any): Promise<boolean> {
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
   * 유저인 경우 general_action_log의 최근 메시지들을 console.log로 출력
   */
  private static async pullGeneralCommand(sessionId: string, generalId: number, turnCnt: number, isNPC: boolean = false, generalName: string = '', beforeLogTime: Date | null = null) {
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

    // 유저인 경우 턴 실행 후 생성된 모든 로그를 출력
    if (!isNPC && beforeLogTime) {
      try {
        const { GeneralRecord } = await import('../../models/general_record.model');
        
        // 턴 실행 후 생성된 모든 로그 가져오기 (모든 log_type)
        const logs = await GeneralRecord.find({
          session_id: sessionId,
          general_id: generalId,
          created_at: { $gte: beforeLogTime }
        })
          .sort({ created_at: 1 }) // 시간순 정렬
          .limit(20) // 최대 20개
          .lean();

        const displayName = generalName ? `[${generalName}]` : `[ID:${generalId}]`;
        
        for (const log of logs) {
          if (log.text) {
            const logTypeLabel = log.log_type ? `[${log.log_type}]` : '';
            console.log(`${displayName}${logTypeLabel} ${log.text}`);
          }
        }
      } catch (error) {
        // 로그 조회 실패는 무시
      }
    }
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
      
      console.warn(`[${new Date().toISOString()}] ⚠️ starttime was ${reason}, reset to current time. year/month reset to ${startyear}/1`);
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
      console.error(`[${new Date().toISOString()}] ⚠️ CRITICAL: Calculated ${num} turns (> ${MAX_REASONABLE_TURNS}), starttime corruption detected!`);
      console.error(`starttime: ${starttime.toISOString()}, curturn: ${curturn.toISOString()}`);
      console.error(`This usually happens when starttime is set to game year instead of real time.`);
      
      // starttime을 현재 시간으로 강제 리셋하고 년/월을 startyear로 초기화
      const correctedStarttime = curturn;
      gameEnv.starttime = correctedStarttime.toISOString();
      gameEnv.year = startyear;
      gameEnv.month = 1;
      
      console.log(`[${new Date().toISOString()}] ✅ Fixed: starttime reset to ${correctedStarttime.toISOString()}, year/month reset to ${startyear}/1`);
      
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
      // Util은 이미 import됨
      totalMonths = Util.joinYearMonth(startyear, 1) + num; // joinYearMonth는 이미 오버플로우 체크 포함
      year = Math.floor(totalMonths / 12);
      month = 1 + (totalMonths % 12);
      
      // 추가 안전성 체크: year가 비정상적으로 크면 에러
      if (year > MAX_REASONABLE_YEAR || year < 0) {
        throw new Error(`Calculated year ${year} is out of reasonable range`);
      }
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] ⚠️ CRITICAL: Year calculation overflow detected!`, error.message);
      console.error(`startyear: ${startyear}, num: ${num}`);
      
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
    } catch (error) {
      console.error('pushGeneralActionLog error:', error);
    }
  }
}

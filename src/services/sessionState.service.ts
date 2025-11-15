/**
 * 세션 상태 관리 서비스
 * 세션의 상태를 중앙에서 관리하고 동기화합니다.
 */

import { Session } from '../models/session.model';
import { logger } from '../common/logger';
import { getSocketManager } from '../socket/socketManager';
import Redis from 'ioredis';
import { sessionRepository } from '../repositories/session.repository';

// Lazy-load cache manager to avoid blocking server startup
let _cacheManager: any = null;
function getCacheManager(): any {
  if (!_cacheManager) {
    const { cacheManager } = require('../cache/CacheManager');
    _cacheManager = cacheManager;
  }
  return _cacheManager;
}

// Redis 클라이언트 (락 관리용)
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

export interface SessionState {
  sessionId: string;
  status: 'preparing' | 'running' | 'paused' | 'finished' | 'united';
  year: number;
  month: number;
  turnterm: number; // 분 단위
  turntime: Date;
  lastExecuted: Date;
  isLocked: boolean;
  isUnited: number; // 0: 진행중, 2: 통합 완료, 3: 통합 실패 (레거시 호환용, deprecated)
  onlineUserCount?: number;
  onlineNations?: number[];
}

export class SessionStateService {
  private static readonly CACHE_TTL = 60; // 60초
  private static readonly LOCK_TTL = 300; // 5분

  /**
   * 세션 상태 조회 (캐시 우선)
   */
  static async getSessionState(sessionId: string): Promise<SessionState | null> {
    try {
      // 캐시에서 조회
      const cacheKey = `session:state:${sessionId}`;
      const cached: SessionState | null = await getCacheManager().get(cacheKey);
      if (cached) {
        return cached;
      }

      // DB에서 조회
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return null;
      }

      const sessionData = session.data || {};
      const gameEnv = sessionData.game_env || {};
      
      // startYear 우선순위: session.startyear > gameEnv.startyear > gameEnv.startYear > 기본값 184
      const startYear = session.startyear || gameEnv.startyear || gameEnv.startYear || 184;
      
      const state: SessionState = {
        sessionId,
        status: this.determineStatus(sessionData),
        year: sessionData.year || gameEnv.year || session.year || startYear,
        month: sessionData.month || gameEnv.month || session.month || 1,
        turnterm: sessionData.turnterm || gameEnv.turnterm || session.turnterm || 60,
        turntime: sessionData.turntime ? new Date(sessionData.turntime) : new Date(),
        lastExecuted: sessionData.turntime ? new Date(sessionData.turntime) : new Date(),
        isLocked: sessionData.is_locked || false,
        isUnited: sessionData.isunited || gameEnv.isunited || 0,
        onlineUserCount: sessionData.online_user_cnt || 0,
        onlineNations: Array.isArray(sessionData.online_nation) 
          ? sessionData.online_nation 
          : (sessionData.online_nation ? [sessionData.online_nation] : [])
      };

      // 캐시에 저장
      await getCacheManager().set(cacheKey, state, this.CACHE_TTL);

      return state;
    } catch (error: any) {
      logger.error('세션 상태 조회 실패', {
        sessionId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * 세션 상태 업데이트
   */
  static async updateSessionState(
    sessionId: string,
    updates: Partial<SessionState>
  ): Promise<boolean> {
    try {
      // 락 획득
      const lockKey = `session:lock:${sessionId}`;
      const lockAcquired = await this.acquireLock(lockKey);
      
      if (!lockAcquired) {
        logger.warn('세션 상태 업데이트 실패: 락 획득 실패', { sessionId });
        return false;
      }

      try {
        // 세션 조회 및 업데이트
        const session = await sessionRepository.findBySessionId(sessionId );
        if (!session) {
          return false;
        }

        // 상태 업데이트
        if (updates.status !== undefined) {
          session.status = updates.status;
        }
        if (updates.year !== undefined) {
          session.year = updates.year;
        }
        if (updates.month !== undefined) {
          session.month = updates.month;
        }
        if (updates.turnterm !== undefined) {
          session.turnterm = updates.turnterm;
        }
        if (updates.turntime !== undefined) {
          session.turntime = updates.turntime;
        }
        if (updates.isLocked !== undefined) {
          session.is_locked = updates.isLocked;
        }
        if (updates.isUnited !== undefined) {
          session.isunited = updates.isUnited;
        }
        if (updates.onlineUserCount !== undefined) {
          session.online_user_cnt = updates.onlineUserCount;
        }
        if (updates.onlineNations !== undefined) {
          session.online_nation = updates.onlineNations;
        }

        await session.save();

        // 캐시 무효화
        await this.invalidateCache(sessionId);

        // Socket.IO로 상태 변경 브로드캐스트
        const socketManager = getSocketManager();
        if (socketManager) {
          socketManager.broadcastGameEvent(sessionId, 'state:updated', {
            sessionId,
            ...updates
          });
        }

        logger.info('세션 상태 업데이트 완료', { sessionId, updates });

        return true;
      } finally {
        await this.releaseLock(lockKey);
      }
    } catch (error: any) {
      logger.error('세션 상태 업데이트 실패', {
        sessionId,
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * 세션 락 획득
   */
  static async acquireSessionLock(sessionId: string, ttl: number = this.LOCK_TTL): Promise<boolean> {
    const lockKey = `session:lock:${sessionId}`;
    return await this.acquireLock(lockKey, ttl);
  }

  /**
   * 세션 락 해제
   */
  static async releaseSessionLock(sessionId: string): Promise<void> {
    const lockKey = `session:lock:${sessionId}`;
    await this.releaseLock(lockKey);
  }

  /**
   * 세션 상태 확인 (락 없이)
   */
  static async checkSessionStatus(sessionId: string): Promise<'available' | 'locked' | 'paused' | 'finished' | 'preparing'> {
    const state = await this.getSessionState(sessionId);
    if (!state) {
      return 'finished';
    }

    if (state.isLocked) {
      return 'locked';
    }

    if (state.status === 'paused') {
      return 'paused';
    }

    if (state.status === 'preparing') {
      return 'preparing'; // 가오픈 상태
    }

    if (state.status === 'finished' || state.status === 'united') {
      return 'finished';
    }

    return 'available';
  }

  /**
   * 세션 일시정지
   */
  static async pauseSession(sessionId: string): Promise<boolean> {
    return await this.updateSessionState(sessionId, {
      status: 'paused'
    });
  }

  /**
   * 세션 재개
   */
  static async resumeSession(sessionId: string): Promise<boolean> {
    return await this.updateSessionState(sessionId, {
      status: 'running'
    });
  }

  /**
   * 세션 종료
   */
  static async finishSession(sessionId: string): Promise<boolean> {
    return await this.updateSessionState(sessionId, {
      status: 'finished',
      isUnited: 3 // 종료
    });
  }

  /**
   * 캐시 무효화
   */
  static async invalidateCache(sessionId: string): Promise<void> {
    const cacheKey = `session:state:${sessionId}`;
    await getCacheManager().delete(cacheKey);
  }

  /**
   * 모든 세션 상태 조회 (관리자용)
   */
  static async getAllSessionStates(): Promise<SessionState[]> {
    try {
      const sessions = await sessionRepository.findAll();
      
      const states: SessionState[] = [];
      for (const session of sessions) {
        const state = await this.getSessionState(session.session_id);
        if (state) {
          states.push(state);
        }
      }

      return states;
    } catch (error: any) {
      logger.error('모든 세션 상태 조회 실패', {
        error: error.message
      });
      return [];
    }
  }

  // Private 메서드

  private static determineStatus(sessionData: any): 'preparing' | 'running' | 'paused' | 'finished' | 'united' {
    // 명시적 status가 있으면 사용
    if (sessionData.status) {
      return sessionData.status;
    }

    // 레거시 isunited 값으로 판단
    if (sessionData.isunited === 3) {
      return 'united'; // 천하통일
    }

    if (sessionData.isunited === 2) {
      return 'preparing'; // 준비중/폐쇄 → 가오픈 상태로 변경
    }

    if (sessionData.is_locked) {
      return 'paused'; // 일시정지
    }

    // 년도/월이 설정되어 있으면 running, 아니면 preparing
    return sessionData.year && sessionData.month ? 'running' : 'preparing';
  }

  private static async acquireLock(lockKey: string, ttl: number = this.LOCK_TTL): Promise<boolean> {
    try {
      const redis = getRedisClient();
      const result = await redis.set(
        lockKey,
        'locked',
        'EX',
        ttl,
        'NX'
      );
      return result === 'OK';
    } catch (error: any) {
      logger.error('락 획득 실패', {
        lockKey,
        error: error.message
      });
      return false;
    }
  }

  private static async releaseLock(lockKey: string): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(lockKey);
    } catch (error: any) {
      logger.error('락 해제 실패', {
        lockKey,
        error: error.message
      });
    }
  }
}



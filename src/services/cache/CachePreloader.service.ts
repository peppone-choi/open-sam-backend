// @ts-nocheck - Mongoose type conflicts
import { logger } from '../../common/logger';
import { saveSession, saveGeneral, saveCity, saveNation } from '../../common/cache/model-cache.helper';
import { sessionRepository } from '../../repositories/session.repository';
import { generalRepository } from '../../repositories/general.repository';
import { cityRepository } from '../../repositories/city.repository';
import { nationRepository } from '../../repositories/nation.repository';

/**
 * 캐시 프리로더
 * 
 * 서버 시작 시 모든 활성 세션의 게임 데이터를 DB에서 캐시로 로드합니다.
 * 이렇게 하면 게임 플레이 중 캐시 미스가 발생하지 않습니다.
 */
export class CachePreloaderService {
  /**
   * 모든 활성 세션의 데이터를 프리로드
   */
  static async preloadAllSessions(): Promise<void> {
    const startTime = Date.now();
    logger.info('[CachePreloader] Starting cache preload...');

    try {
      // Redis 연결 확인 및 대기
      const { cacheManager } = await import('../../cache/CacheManager');
      logger.info('[CachePreloader] Waiting for Redis L2 cache to be ready...');
      
      const redisReady = await cacheManager.waitForRedis(5000);
      if (redisReady) {
        logger.info('[CachePreloader] ✅ Redis L2 cache is ready');
      } else {
        logger.warn('[CachePreloader] ⚠️ Redis L2 cache not available, proceeding with L1 only');
      }
      

      // 활성 세션 조회
      const sessions = await sessionRepository.findByFilter({
        $or: [
          { status: 'running' },
          { 'data.status': { $ne: 'paused' } }
        ]
      });

      if (sessions.length === 0) {
        logger.info('[CachePreloader] No active sessions found');
        return;
      }

      logger.info(`[CachePreloader] Found ${sessions.length} active session(s)`);

      let totalGenerals = 0;
      let totalCities = 0;
      let totalNations = 0;

      for (const session of sessions) {
        const sessionId = session.session_id;
        logger.info(`[CachePreloader] Loading session: ${sessionId}`);

        try {
          // 세션 데이터 캐시
          await saveSession(sessionId, session);

          // 장수 데이터 프리로드
          const generals = await generalRepository.findBySession(sessionId);
          for (const general of generals) {
            const no = general.no || general.data?.no;
            if (no) {
              await saveGeneral(sessionId, no, general);
              
              // owner 기준 캐시도 추가 (유저 ID로 조회 시 사용)
              if (general.owner) {
                const { cacheManager } = await import('../../cache/CacheManager');
                await cacheManager.set(`general:owner:${sessionId}:${general.owner}`, general, 360);
              }
              
              totalGenerals++;
            }
          }

          // 도시 데이터 프리로드
          const cities = await cityRepository.findBySession(sessionId);
          for (const city of cities) {
            if (city.city) {
              await saveCity(sessionId, city.city, city);
              totalCities++;
            }
          }

          // 국가 데이터 프리로드
          const nations = await nationRepository.findBySession(sessionId);
          for (const nation of nations) {
            if (nation.nation) {
              await saveNation(sessionId, nation.nation, nation);
              totalNations++;
            }
          }

          logger.info(`[CachePreloader] Session ${sessionId}: Loaded ${generals.length} generals, ${cities.length} cities, ${nations.length} nations`);
        } catch (error: any) {
          logger.error(`[CachePreloader] Failed to preload session ${sessionId}:`, {
            message: error?.message,
            stack: error?.stack,
            error: error
          });
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`[CachePreloader] Preload completed in ${duration}ms`);
      logger.info(`[CachePreloader] Total loaded: ${totalGenerals} generals, ${totalCities} cities, ${totalNations} nations`);
    } catch (error: any) {
      logger.error('[CachePreloader] Fatal error during preload:', {
        message: error?.message,
        stack: error?.stack,
        error: error
      });
      throw error;
    }
  }

  /**
   * 특정 세션의 데이터를 프리로드
   */
  static async preloadSession(sessionId: string): Promise<void> {
    logger.info(`[CachePreloader] Preloading session: ${sessionId}`);

    try {
      // 세션 조회
      const session = await sessionRepository.findById(sessionId);
      if (!session) {
        logger.warn(`[CachePreloader] Session not found: ${sessionId}`);
        return;
      }

      // 세션 데이터 캐시
      await saveSession(sessionId, session);

      // 장수 데이터 프리로드
      const generals = await generalRepository.findBySession(sessionId);
      for (const general of generals) {
        const no = general.no || general.data?.no;
        if (no) {
          await saveGeneral(sessionId, no, general);
          
          // owner 기준 캐시도 추가 (유저 ID로 조회 시 사용)
          if (general.owner) {
            const { cacheManager } = await import('../../cache/CacheManager');
            await cacheManager.set(`general:owner:${sessionId}:${general.owner}`, general, 360);
          }
        }
      }

      // 도시 데이터 프리로드
      const cities = await cityRepository.findBySession(sessionId);
      for (const city of cities) {
        if (city.city) {
          await saveCity(sessionId, city.city, city);
        }
      }

      // 국가 데이터 프리로드
      const nations = await nationRepository.findBySession(sessionId);
      for (const nation of nations) {
        if (nation.nation) {
          await saveNation(sessionId, nation.nation, nation);
        }
      }

      logger.info(`[CachePreloader] Session ${sessionId}: Loaded ${generals.length} generals, ${cities.length} cities, ${nations.length} nations`);
    } catch (error: any) {
      logger.error(`[CachePreloader] Failed to preload session ${sessionId}:`, {
        message: error?.message,
        stack: error?.stack,
        error: error
      });
      throw error;
    }
  }
}

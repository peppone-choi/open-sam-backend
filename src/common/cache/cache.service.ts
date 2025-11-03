import { cacheManager } from '../../cache/CacheManager';
import { logger } from '../logger';

/**
 * 캐시 서비스
 * 
 * 캐시 조회/저장/무효화를 위한 헬퍼 메서드를 제공합니다.
 * getOrLoad 패턴으로 캐시 미스 시 자동으로 데이터를 로드하고 저장합니다.
 * 
 * @example
 * const session = await cacheService.getOrLoad(
 *   'session:123',
 *   () => sessionRepository.findById('123'),
 *   60
 * );
 */
class CacheService {
  /**
   * L1 → L2 → DB 순서로 데이터를 조회하고 캐시에 저장
   * 
   * 동작 순서:
   * 1. L1 (메모리) 캐시 조회 → 히트 시 즉시 반환
   * 2. L2 (Redis) 캐시 조회 → 히트 시 L1 업데이트 후 반환
   * 3. DB 조회 → L2와 L1 모두 업데이트 후 반환
   * 
   * @param key - 캐시 키
   * @param loader - DB에서 데이터를 로드하는 함수
   * @param ttl - L2 캐시 TTL (초 단위, 기본 60초). L1은 항상 10초
   * @returns 캐시된 데이터 또는 DB에서 로드된 데이터
   */
  async getOrLoad<T>(
    key: string,
    loader: () => Promise<T>,
    ttl: number = 60
  ): Promise<T | null> {
    try {
      // 1. L1 캐시 조회 (메모리)
      const l1Data = await cacheManager.getL1<T>(key);
      if (l1Data !== null && l1Data !== undefined) {
        logger.debug('L1 캐시 히트', { key });
        return l1Data;
      }

      // 2. L2 캐시 조회 (Redis)
      const l2Data = await cacheManager.getL2<T>(key);
      if (l2Data !== null && l2Data !== undefined) {
        logger.debug('L2 캐시 히트', { key });
        // L1 캐시 업데이트 (다음 요청을 위해)
        await cacheManager.setL1(key, l2Data);
        return l2Data;
      }

      // 3. DB 조회
      logger.debug('캐시 미스 - DB 조회', { key });
      const data = await loader();

      // 4. DB 조회 후 L2와 L1 모두 업데이트
      if (data !== null && data !== undefined) {
        // L2에 저장 (긴 TTL)
        await cacheManager.setL2(key, data, ttl);
        // L1에 저장 (10초 TTL)
        await cacheManager.setL1(key, data);
        logger.debug('L1, L2 캐시 저장 완료', { key, ttl });
      }

      return data;
    } catch (error) {
      logger.error('캐시 getOrLoad 실패', {
        key,
        error: error instanceof Error ? error.message : String(error)
      });
      // 캐시 실패 시에도 DB 조회는 시도
      try {
        return await loader();
      } catch (dbError) {
        logger.error('DB 조회 실패', {
          key,
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });
        return null;
      }
    }
  }

  /**
   * 특정 키들과 패턴에 해당하는 캐시 무효화
   * 
   * @param keys - 삭제할 캐시 키 목록
   * @param patterns - 삭제할 캐시 패턴 목록 (예: 'session:*')
   */
  async invalidate(keys: string[] = [], patterns: string[] = []): Promise<void> {
    try {
      // 개별 키 삭제
      for (const k of keys) {
        await cacheManager.delete(k);
        logger.debug('캐시 삭제', { key: k });
      }

      // 패턴 매칭 삭제
      for (const p of patterns) {
        await cacheManager.deletePattern(p);
        logger.debug('캐시 패턴 삭제', { pattern: p });
      }
    } catch (error) {
      logger.error('캐시 무효화 실패', {
        keys,
        patterns,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 캐시 통계 조회
   */
  getStats() {
    return cacheManager.getStats();
  }
}

/**
 * 캐시 서비스 싱글톤 인스턴스
 */
export const cacheService = new CacheService();

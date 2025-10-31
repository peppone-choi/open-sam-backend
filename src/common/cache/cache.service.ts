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
   * 캐시에서 데이터를 가져오거나, 없으면 로더 함수를 실행하여 캐시에 저장
   * 
   * @param key - 캐시 키
   * @param loader - 캐시 미스 시 실행할 데이터 로드 함수
   * @param ttl - TTL (초 단위, 기본 60초)
   * @returns 캐시된 데이터 또는 로드된 데이터
   */
  async getOrLoad<T>(
    key: string,
    loader: () => Promise<T>,
    ttl: number = 60
  ): Promise<T | null> {
    try {
      // 캐시 조회
      const cached = await cacheManager.get<T>(key);
      if (cached !== null && cached !== undefined) {
        logger.debug('캐시 히트', { key });
        return cached;
      }

      // 캐시 미스 - 데이터 로드
      logger.debug('캐시 미스', { key });
      const data = await loader();

      // 데이터가 있으면 캐시에 저장
      if (data !== null && data !== undefined) {
        await cacheManager.set(key, data, ttl);
        logger.debug('캐시 저장', { key, ttl });
      }

      return data;
    } catch (error) {
      logger.error('캐시 getOrLoad 실패', {
        key,
        error: error instanceof Error ? error.message : String(error)
      });
      // 캐시 실패 시에도 데이터는 반환
      return loader();
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

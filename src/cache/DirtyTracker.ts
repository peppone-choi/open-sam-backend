import { logger } from '../common/logger';
import { cacheManager } from './CacheManager';

/**
 * Dirty Tracking 시스템
 *
 * 변경된 엔티티를 추적하여 주기적으로 DB에 저장합니다.
 *
 * 동작 원리:
 * 1. 엔티티 수정 시 markDirty() 호출
 * 2. Redis Set에 dirty 엔티티 ID 저장
 * 3. 크론이 5초마다 dirty 엔티티를 DB에 저장
 * 4. 저장 완료 후 dirty 마킹 제거
 *
 * @example
 * // 장수 데이터 수정
 * const general = await cacheManager.get(`general:${id}`);
 * general.gold += 100;
 * await cacheManager.set(`general:${id}`, general);
 * await dirtyTracker.markDirty('general', id);
 *
 * // 크론에서 자동 저장
 * await dirtyTracker.flushToDB(generalRepository);
 */
export class DirtyTracker {
  private static instance: DirtyTracker;

  /**
   * Dirty 엔티티 타입별 Set
   *
   * Redis Set 키 형식: `dirty:{entityType}`
   * 예: `dirty:general`, `dirty:city`, `dirty:nation`
   */
  private readonly DIRTY_KEY_PREFIX = 'dirty:';

  private constructor() {}

  public static getInstance(): DirtyTracker {
    if (!DirtyTracker.instance) {
      DirtyTracker.instance = new DirtyTracker();
    }
    return DirtyTracker.instance;
  }

  /**
   * 엔티티를 dirty로 마킹
   *
   * @param entityType - 엔티티 타입 (예: 'general', 'city')
   * @param entityId - 엔티티 ID
   */
  async markDirty(entityType: string, entityId: string): Promise<void> {
    const redis = cacheManager.getRedisClient();
    if (!redis) {
      logger.warn('Redis 연결 없음 - dirty 마킹 실패', { entityType, entityId });
      return;
    }

    try {
      const dirtyKey = `${this.DIRTY_KEY_PREFIX}${entityType}`;
      await redis.sAdd(dirtyKey, entityId);
      logger.debug('Dirty 마킹', { entityType, entityId, dirtyKey });
    } catch (error) {
      logger.error('Dirty 마킹 실패', {
        entityType,
        entityId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 여러 엔티티를 한 번에 dirty로 마킹
   *
   * @param entityType - 엔티티 타입
   * @param entityIds - 엔티티 ID 배열
   */
  async markManyDirty(entityType: string, entityIds: string[]): Promise<void> {
    if (entityIds.length === 0) return;

    const redis = cacheManager.getRedisClient();
    if (!redis) {
      logger.warn('Redis 연결 없음 - dirty 마킹 실패', { entityType, count: entityIds.length });
      return;
    }

    try {
      const dirtyKey = `${this.DIRTY_KEY_PREFIX}${entityType}`;
      await redis.sAdd(dirtyKey, entityIds);
      logger.debug('Dirty 일괄 마킹', { entityType, count: entityIds.length });
    } catch (error) {
      logger.error('Dirty 일괄 마킹 실패', {
        entityType,
        count: entityIds.length,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Dirty 엔티티 목록 조회
   *
   * @param entityType - 엔티티 타입
   * @returns Dirty 엔티티 ID 배열
   */
  async getDirtyIds(entityType: string): Promise<string[]> {
    const redis = cacheManager.getRedisClient();
    if (!redis) {
      return [];
    }

    try {
      const dirtyKey = `${this.DIRTY_KEY_PREFIX}${entityType}`;
      const ids = await redis.sMembers(dirtyKey);
      return ids;
    } catch (error) {
      logger.error('Dirty 목록 조회 실패', {
        entityType,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Dirty 엔티티 개수 조회
   *
   * @param entityType - 엔티티 타입
   * @returns Dirty 엔티티 개수
   */
  async getDirtyCount(entityType: string): Promise<number> {
    const redis = cacheManager.getRedisClient();
    if (!redis) {
      return 0;
    }

    try {
      const dirtyKey = `${this.DIRTY_KEY_PREFIX}${entityType}`;
      const count = await redis.sCard(dirtyKey);
      return count;
    } catch (error) {
      logger.error('Dirty 개수 조회 실패', {
        entityType,
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }

  /**
   * Dirty 마킹 제거
   *
   * DB 저장 완료 후 호출합니다.
   *
   * @param entityType - 엔티티 타입
   * @param entityId - 엔티티 ID
   */
  async clearDirty(entityType: string, entityId: string): Promise<void> {
    const redis = cacheManager.getRedisClient();
    if (!redis) {
      return;
    }

    try {
      const dirtyKey = `${this.DIRTY_KEY_PREFIX}${entityType}`;
      await redis.sRem(dirtyKey, entityId);
      logger.debug('Dirty 마킹 제거', { entityType, entityId });
    } catch (error) {
      logger.error('Dirty 마킹 제거 실패', {
        entityType,
        entityId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 여러 엔티티의 dirty 마킹 제거
   *
   * @param entityType - 엔티티 타입
   * @param entityIds - 엔티티 ID 배열
   */
  async clearManyDirty(entityType: string, entityIds: string[]): Promise<void> {
    if (entityIds.length === 0) return;

    const redis = cacheManager.getRedisClient();
    if (!redis) {
      return;
    }

    try {
      const dirtyKey = `${this.DIRTY_KEY_PREFIX}${entityType}`;
      await redis.sRem(dirtyKey, entityIds);
      logger.debug('Dirty 일괄 제거', { entityType, count: entityIds.length });
    } catch (error) {
      logger.error('Dirty 일괄 제거 실패', {
        entityType,
        count: entityIds.length,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 모든 dirty 엔티티 목록 조회 (모든 타입)
   *
   * @returns { entityType: string[] } 형태의 객체
   */
  async getAllDirty(): Promise<Record<string, string[]>> {
    const redis = cacheManager.getRedisClient();
    if (!redis) {
      return {};
    }

    try {
      // dirty:* 패턴으로 모든 키 찾기
      const dirtyKeys = await cacheManager.scan(`${this.DIRTY_KEY_PREFIX}*`);

      const result: Record<string, string[]> = {};

      for (const dirtyKey of dirtyKeys) {
        const entityType = dirtyKey.replace(this.DIRTY_KEY_PREFIX, '');
        const ids = await redis.sMembers(dirtyKey);
        result[entityType] = ids;
      }

      return result;
    } catch (error) {
      logger.error('전체 Dirty 목록 조회 실패', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {};
    }
  }

  /**
   * 통계 조회
   */
  async getStats(): Promise<Record<string, number>> {
    const allDirty = await this.getAllDirty();

    const stats: Record<string, number> = {};
    for (const [entityType, ids] of Object.entries(allDirty)) {
      stats[entityType] = ids.length;
    }

    return stats;
  }

  /**
   * 특정 엔티티 타입의 모든 dirty 마킹 제거
   *
   * @param entityType - 엔티티 타입
   */
  async clearAllDirty(entityType: string): Promise<void> {
    const redis = cacheManager.getRedisClient();
    if (!redis) {
      return;
    }

    try {
      const dirtyKey = `${this.DIRTY_KEY_PREFIX}${entityType}`;
      await redis.del(dirtyKey);
      logger.info('전체 Dirty 마킹 제거', { entityType });
    } catch (error) {
      logger.error('전체 Dirty 마킹 제거 실패', {
        entityType,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

/**
 * Dirty Tracker 싱글톤 인스턴스
 */
export const dirtyTracker = DirtyTracker.getInstance();

import { L1CacheService } from './l1-cache.service';
import { RedisService } from './redis.service';

/**
 * 2-Tier 캐시 매니저
 * L1: node-cache (3초 TTL)
 * L2: Redis (선택적 TTL)
 */
export class CacheManager {
  private l1Cache: L1CacheService;
  private redisService: RedisService;

  constructor() {
    this.l1Cache = new L1CacheService(3);
    this.redisService = new RedisService();

    // TODO: 캐시 무효화 Pub/Sub 구독
    this.subscribeToInvalidation();
  }

  /**
   * 데이터 조회 (L1 → L2 → null)
   */
  async get<T>(key: string): Promise<T | null> {
    // TODO: L1 캐시 확인
    const l1Value = this.l1Cache.get<T>(key);
    if (l1Value !== undefined) {
      return l1Value;
    }

    // TODO: L2 캐시 확인 (Redis)
    const l2Value = await this.redisService.get<T>(key);
    if (l2Value) {
      // L1 캐시에 저장
      this.l1Cache.set(key, l2Value);
      return l2Value;
    }

    return null;
  }

  /**
   * 데이터 저장 (L1 + L2)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // TODO: L1 캐시에 저장
    this.l1Cache.set(key, value, ttl || 3);

    // TODO: L2 캐시에 저장 (Redis)
    await this.redisService.set(key, value, ttl);
  }

  /**
   * 캐시 무효화 (L1 + L2 + Pub/Sub 알림)
   */
  async invalidate(key: string): Promise<void> {
    // TODO: L1 캐시 삭제
    this.l1Cache.del(key);

    // TODO: L2 캐시 삭제
    await this.redisService.del(key);

    // TODO: 다른 API 서버에 무효화 알림
    await this.redisService.publish('channel:cache:invalidate', key);
  }

  /**
   * 캐시 무효화 Pub/Sub 구독
   */
  private subscribeToInvalidation(): void {
    // TODO: 구현
    this.redisService.subscribe('channel:cache:invalidate', (key: string) => {
      this.l1Cache.del(key);
      // console.log(`Cache invalidated: ${key}`);
    });
  }

  /**
   * 통계 조회
   */
  getStats() {
    return {
      l1: this.l1Cache.getStats(),
    };
  }
}

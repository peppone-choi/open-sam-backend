import NodeCache from 'node-cache';

/**
 * L1 캐시 서비스 (node-cache)
 * 로컬 인메모리 캐시 (3초 TTL)
 */
export class L1CacheService {
  private cache: NodeCache;

  constructor(ttl: number = 3) {
    this.cache = new NodeCache({
      stdTTL: ttl,
      checkperiod: 1,
      useClones: false, // 성능 최적화
    });

    // TODO: 통계 로깅
    this.cache.on('expired', (key, _value) => {
      // console.log(`L1 Cache expired: ${key}`);
    });
  }

  /**
   * 데이터 조회
   */
  get<T>(key: string): T | undefined {
    // TODO: 구현
    return this.cache.get<T>(key);
  }

  /**
   * 데이터 저장
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    // TODO: 구현
    return this.cache.set(key, value, ttl || 3);
  }

  /**
   * 데이터 삭제
   */
  del(key: string): number {
    // TODO: 구현
    return this.cache.del(key);
  }

  /**
   * 전체 캐시 삭제
   */
  flush(): void {
    this.cache.flushAll();
  }

  /**
   * 통계 조회
   */
  getStats() {
    return this.cache.getStats();
  }
}

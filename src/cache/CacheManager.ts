import NodeCache from 'node-cache';
import { createClient, RedisClientType } from 'redis';
import { logger } from '../common/logger';

/**
 * 3단계 캐싱 시스템
 * 
 * L1: 메모리 (NodeCache) - TTL 10초
 * L2: Redis - TTL 60초  
 * L3: MongoDB - 영구 저장
 * 
 * 읽기 순서: L1 → L2 → L3
 * 쓰기 순서: L3 → L2 → L1
 * 
 * @example
 * const cache = CacheManager.getInstance();
 * await cache.set('user:123', userData, 60);
 * const data = await cache.get('user:123');
 */
export class CacheManager {
  private static instance: CacheManager;
  private l1Cache: NodeCache;
  private l2Cache: RedisClientType | null = null;
  private l2Connected: boolean = false;

  private constructor() {
    // L1: 메모리 캐시 (10초 TTL)
    this.l1Cache = new NodeCache({
      stdTTL: 10,
      checkperiod: 5,
      useClones: false // 성능 최적화
    });

    // L2: Redis 연결
    this.initRedis();
  }

  /**
   * Redis 초기화
   * 
   * 연결 실패 시 L1 캐시만 사용합니다.
   */
  private async initRedis() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.l2Cache = createClient({ url: redisUrl }) as RedisClientType;
      
      this.l2Cache.on('error', (err) => {
        logger.error('Redis 연결 에러', { error: err.message });
        this.l2Connected = false;
      });

      this.l2Cache.on('connect', () => {
        logger.info('Redis L2 캐시 연결 성공');
        this.l2Connected = true;
      });

      await this.l2Cache.connect();
    } catch (error) {
      logger.warn('Redis L2 캐시 비활성화 (메모리 캐시만 사용)');
      this.l2Connected = false;
    }
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * 캐시에서 데이터 조회
   * 
   * L1 → L2 → L3(DB) 순서로 확인합니다.
   * 
   * @param key - 캐시 키
   * @returns 캐시된 데이터 또는 null
   */
  async get<T>(key: string): Promise<T | null> {
    // L1: 메모리 캐시
    const l1Data = this.l1Cache.get<T>(key);
    if (l1Data !== undefined) {
      return l1Data;
    }

    // L2: Redis 캐시
    if (this.l2Connected && this.l2Cache) {
      try {
        const l2Data = await this.l2Cache.get(key);
        if (l2Data && typeof l2Data === 'string') {
          const parsed = JSON.parse(l2Data) as T;
          // L1에 다시 저장
          this.l1Cache.set(key, parsed);
          return parsed;
        }
      } catch (error) {
        logger.error('Redis get 에러', { 
          key, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    return null;
  }

  /**
   * 캐시에 데이터 저장
   * 
   * L1, L2에 모두 저장합니다.
   * 
   * @param key - 캐시 키
   * @param value - 저장할 데이터
   * @param ttl - TTL (초 단위, 기본값: L1=10초, L2=60초)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // L1: 메모리 캐시 (10초)
    this.l1Cache.set(key, value, ttl || 10);

    // L2: Redis 캐시 (60초)
    if (this.l2Connected && this.l2Cache) {
      try {
        await this.l2Cache.setEx(
          key,
          ttl || 60,
          JSON.stringify(value)
        );
      } catch (error) {
        logger.error('Redis set 에러', { 
          key, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
  }

  /**
   * 캐시 무효화 (모든 레벨에서 삭제)
   * 
   * @param key - 삭제할 캐시 키
   */
  async delete(key: string): Promise<void> {
    // L1
    this.l1Cache.del(key);

    // L2
    if (this.l2Connected && this.l2Cache) {
      try {
        await this.l2Cache.del(key);
      } catch (error) {
        logger.error('Redis delete 에러', { 
          key, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
  }

  /**
   * 패턴 매칭으로 캐시 무효화
   * 
   * @param pattern - 패턴 (예: 'session:*')
   * @example
   * await cache.deletePattern('user:*'); // user:로 시작하는 모든 키 삭제
   */
  async deletePattern(pattern: string): Promise<void> {
    // L1: NodeCache는 패턴 매칭 없으므로 전체 키 확인
    const keys = this.l1Cache.keys();
    const regex = new RegExp(pattern.replace('*', '.*'));
    keys.forEach(key => {
      if (regex.test(key)) {
        this.l1Cache.del(key);
      }
    });

    // L2: Redis SCAN
    if (this.l2Connected && this.l2Cache) {
      try {
        const keys = await this.l2Cache.keys(pattern);
        if (keys.length > 0) {
          await this.l2Cache.del(keys);
        }
      } catch (error) {
        logger.error('Redis deletePattern 에러', { 
          pattern, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
  }

  /**
   * 캐시 통계
   */
  getStats() {
    return {
      l1: this.l1Cache.getStats(),
      l2Connected: this.l2Connected
    };
  }

  /**
   * Redis 연결 종료
   */
  async close() {
    if (this.l2Cache) {
      await this.l2Cache.quit();
    }
  }
}

// 싱글톤 인스턴스 export
export const cacheManager = CacheManager.getInstance();

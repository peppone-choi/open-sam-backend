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
      this.l2Cache = createClient({ 
        url: redisUrl,
        socket: {
          connectTimeout: 5000,
          reconnectStrategy: (retries) => {
            if (retries > 3) {
              logger.warn('Redis 재연결 시도 중단 (메모리 캐시만 사용)');
              return false;
            }
            return Math.min(retries * 100, 3000);
          }
        }
      }) as RedisClientType;
      
      this.l2Cache.on('error', (err) => {
        logger.error('Redis 연결 에러', { error: err.message });
        this.l2Connected = false;
      });

      this.l2Cache.on('connect', () => {
        logger.info('Redis L2 캐시 연결 성공');
        this.l2Connected = true;
      });

      this.l2Cache.on('ready', () => {
        logger.info('Redis L2 캐시 준비 완료');
        this.l2Connected = true;
      });

      await this.l2Cache.connect();
    } catch (error: any) {
      logger.warn('Redis L2 캐시 비활성화 (메모리 캐시만 사용)', { error: error.message });
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
   * L1 캐시만 조회 (메모리)
   */
  async getL1<T>(key: string): Promise<T | null> {
    const data = this.l1Cache.get<T>(key);
    return data !== undefined ? data : null;
  }

  /**
   * L2 캐시만 조회 (Redis)
   */
  async getL2<T>(key: string): Promise<T | null> {
    if (!this.l2Connected || !this.l2Cache) {
      return null;
    }

    try {
      const l2Data = await this.l2Cache.get(key);
      if (l2Data && typeof l2Data === 'string') {
        return JSON.parse(l2Data) as T;
      }
    } catch (error) {
      logger.error('Redis getL2 에러', { 
        key, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }

    return null;
  }

  /**
   * L1 캐시에 저장
   */
  async setL1<T>(key: string, value: T, ttl: number = 10): Promise<void> {
    this.l1Cache.set(key, value, ttl);
  }

  /**
   * L2 캐시에 저장
   */
  async setL2<T>(key: string, value: T, ttl: number = 60): Promise<void> {
    if (!this.l2Connected || !this.l2Cache) {
      return;
    }

    try {
      await this.l2Cache.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error('Redis setL2 에러', { 
        key, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * 캐시에서 데이터 조회
   * 
   * L1 → L2 순서로 확인합니다.
   * L2 히트 시 자동으로 L1에도 저장합니다.
   * 
   * @param key - 캐시 키
   * @returns 캐시된 데이터 또는 null
   */
  async get<T>(key: string): Promise<T | null> {
    // L1: 메모리 캐시
    const l1Data = await this.getL1<T>(key);
    if (l1Data !== null) {
      return l1Data;
    }

    // L2: Redis 캐시
    const l2Data = await this.getL2<T>(key);
    if (l2Data !== null) {
      // L1에 다시 저장 (다음 요청을 위해)
      await this.setL1(key, l2Data);
      return l2Data;
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
   * @param ttl - L2 캐시 TTL (초 단위, 기본값: 60초). L1은 항상 10초
   */
  async set<T>(key: string, value: T, ttl: number = 60): Promise<void> {
    // L1과 L2 모두 저장
    await Promise.all([
      this.setL1(key, value, 10), // L1은 항상 10초
      this.setL2(key, value, ttl)  // L2는 지정된 TTL
    ]);
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

  /**
   * Redis 클라이언트 접근 (데몬용 SCAN 등)
   */
  getRedisClient(): RedisClientType | null {
    return this.l2Connected && this.l2Cache ? this.l2Cache : null;
  }

  /**
   * Redis SCAN 실행 (패턴 매칭)
   */
  async scan(pattern: string, count: number = 100): Promise<string[]> {
    const redis = this.getRedisClient();
    if (!redis) {
      return [];
    }

    try {
      const keys: string[] = [];
      let cursor = '0';
      
      do {
        const result = await redis.scan(cursor, {
          MATCH: pattern,
          COUNT: count
        });
        
        cursor = result.cursor;
        keys.push(...result.keys);
      } while (cursor !== '0');
      
      return keys;
    } catch (error) {
      logger.error('Redis SCAN 에러', { 
        pattern, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return [];
    }
  }
}

// 싱글톤 인스턴스 export
export const cacheManager = CacheManager.getInstance();


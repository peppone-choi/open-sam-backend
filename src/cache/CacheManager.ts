import NodeCache from 'node-cache';
import { createClient, RedisClientType } from 'redis';
import { logger } from '../common/logger';
import { redisHealthMonitor } from '../services/monitoring/RedisHealthMonitor';
import { configManager } from '../config/ConfigManager';

const { system, features } = configManager.get();

const isTestEnv = system.nodeEnv === 'test';
const shouldUseRedisL2 = features.enableRedisAdapter && !isTestEnv;

type L2BatchEntry = {
  key: string;
  value: unknown;
  ttl?: number;
};

/**
 * 3단계 캐싱 시스템
 */
export class CacheManager {
  private static instance: CacheManager;
  private l1Cache: NodeCache;
  private l2Cache: RedisClientType | null = null;
  private l2Connected: boolean = false;
  private l2Connecting: boolean = false;
  private redisInitPromise: Promise<void> | null = null;
  private readonly useRedis: boolean;

  private constructor() {
    this.l1Cache = new NodeCache({
      stdTTL: 3,
      checkperiod: 1,
      useClones: false
    });

    this.useRedis = shouldUseRedisL2;
    if (this.useRedis) {
      this.redisInitPromise = this.initRedis();
    } else if (!isTestEnv) {
      logger.info('Redis L2 캐시 비활성화');
    }
  }

  private async initRedis(): Promise<void> {
    if (!this.useRedis) return;
    if (this.l2Connecting) return this.redisInitPromise || Promise.resolve();
    
    this.l2Connecting = true;
    
    try {
      const { redisUrl } = system;
      logger.info(`Redis 연결 시도: ${redisUrl}`);
      
      this.l2Cache = createClient({ 
        url: redisUrl,
        socket: {
          connectTimeout: 10000,
          reconnectStrategy: (retries) => {
            if (retries <= 5) return Math.min(retries * 50, 1000);
            if (retries <= 10) return 2000;
            return false;
          }
        }
      }) as RedisClientType;
      
      this.l2Cache.on('error', (err) => {
        logger.error('Redis 연결 에러', { error: err.message });
        this.l2Connected = false;
        redisHealthMonitor.recordDisconnected('cache-manager:error', err instanceof Error ? err.message : undefined);
      });

      this.l2Cache.on('connect', () => {
        this.l2Connected = true;
        redisHealthMonitor.recordConnected('cache-manager:connect');
      });

      this.l2Cache.on('ready', () => {
        logger.info('Redis L2 캐시 준비 완료');
        this.l2Connected = true;
        redisHealthMonitor.recordConnected('cache-manager:ready');
      });

      await this.l2Cache.connect();
    } catch (error: any) {
      logger.warn('Redis L2 캐시 비활성화 (메모리 캐시만 사용)', { error: error.message });
      this.l2Connected = false;
      redisHealthMonitor.recordDisconnected('cache-manager:init', error?.message);
    } finally {
      this.l2Connecting = false;
    }
  }
  
  public async waitForRedis(timeoutMs: number = 5000): Promise<boolean> {
    if (!this.useRedis) return false;
    const startTime = Date.now();
    if (this.redisInitPromise) {
      try {
        await Promise.race([
          this.redisInitPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Redis init timeout')), timeoutMs))
        ]);
      } catch (error: any) {
        return false;
      }
    }
    while (Date.now() - startTime < timeoutMs) {
      if (this.l2Connected) return true;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return this.l2Connected;
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  async getL1<T>(key: string): Promise<T | null> {
    const data = this.l1Cache.get<T>(key);
    return data !== undefined ? data : null;
  }

  async getL2<T>(key: string): Promise<T | null> {
    if (!this.useRedis || !this.l2Connected || !this.l2Cache) return null;
    try {
      const l2Data = await this.l2Cache.get(key);
      if (l2Data && typeof l2Data === 'string') return JSON.parse(l2Data) as T;
    } catch (error) {
      logger.error('Redis getL2 에러', { key });
    }
    return null;
  }

  async setL1<T>(key: string, value: T, ttl: number = 3): Promise<void> {
    this.l1Cache.set(key, value, ttl);
  }

  async setL2<T>(key: string, value: T, ttl: number = 360): Promise<void> {
    if (!this.useRedis || !this.l2Connected || !this.l2Cache) return;
    try {
      await this.l2Cache.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error('Redis setL2 에러', { key });
    }
  }

  async setL2Batch(entries: L2BatchEntry[]): Promise<void> {
    if (!this.useRedis || !this.l2Connected || !this.l2Cache || entries.length === 0) return;
    const pipeline = this.l2Cache.multi();
    entries.forEach(({ key, value, ttl }) => {
      pipeline.setEx(key, ttl ?? 360, JSON.stringify(value));
    });
    try {
      await pipeline.exec();
    } catch (error) {
      logger.error('Redis setL2Batch 에러');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const l1Data = await this.getL1<T>(key);
    if (l1Data !== null) return l1Data;
    const l2Data = await this.getL2<T>(key);
    if (l2Data !== null) {
      await this.setL1(key, l2Data);
      return l2Data;
    }
    return null;
  }

  async set<T>(key: string, value: T, ttl: number = 360): Promise<void> {
    await Promise.all([
      this.setL1(key, value, 3),
      this.setL2(key, value, ttl)
    ]);
  }

  async delete(key: string): Promise<void> {
    this.l1Cache.del(key);
    if (this.useRedis && this.l2Connected && this.l2Cache) {
      try {
        await this.l2Cache.del(key);
      } catch (error) {
        logger.error('Redis delete 에러', { key });
      }
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    const keys = this.l1Cache.keys();
    const regex = new RegExp(pattern.replace('*', '.*'));
    keys.forEach(key => {
      if (regex.test(key)) this.l1Cache.del(key);
    });
    if (this.useRedis && this.l2Connected && this.l2Cache) {
      try {
        const keys = await this.l2Cache.keys(pattern);
        if (keys.length > 0) await this.l2Cache.del(keys);
      } catch (error) {
        logger.error('Redis deletePattern 에러', { pattern });
      }
    }
  }

  getStats() {
    return {
      l1: this.l1Cache.getStats(),
      l2Connected: this.l2Connected
    };
  }

  async close() {
    if (this.l2Cache) await this.l2Cache.quit();
  }

  getRedisClient(): RedisClientType | null {
    return this.useRedis && this.l2Connected && this.l2Cache ? this.l2Cache : null;
  }

  async scan(pattern: string, count: number = 100): Promise<string[]> {
    const redis = this.getRedisClient();
    if (!redis) return [];
    try {
      const keys: string[] = [];
      let cursor = '0';
      do {
        const result = await redis.scan(cursor, { MATCH: pattern, COUNT: count });
        cursor = result.cursor;
        keys.push(...result.keys);
      } while (cursor !== '0');
      return keys;
    } catch (error) {
      logger.error('Redis SCAN 에러', { pattern });
      return [];
    }
  }
}

export const cacheManager = CacheManager.getInstance();

import { L1CacheService } from './l1-cache.service';
import { RedisService } from './redis.service';

export class CacheManager {
  private l1: L1CacheService;
  private l2: RedisService;

  constructor() {
    this.l1 = new L1CacheService();
    this.l2 = new RedisService();
    
    this.l2.subscribe('channel:cache:invalidate', (key) => {
      this.l1.del(key);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const l1Data = this.l1.get<T>(key);
    if (l1Data) return l1Data;

    const l2Data = await this.l2.hgetall(key);
    if (l2Data && Object.keys(l2Data).length > 0) {
      const parsed = JSON.parse(l2Data.data || '{}') as T;
      this.l1.set(key, parsed);
      return parsed;
    }

    return null;
  }

  async set(key: string, value: any, ttl: number = 3): Promise<void> {
    this.l1.set(key, value, ttl);

    await this.l2.hset(key, {
      data: JSON.stringify(value),
      updatedAt: Date.now().toString(),
      version: Date.now().toString()
    });
  }

  async invalidate(key: string): Promise<void> {
    this.l1.del(key);
    await this.l2.publish('channel:cache:invalidate', key);
  }
}

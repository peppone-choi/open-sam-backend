import NodeCache from 'node-cache';
import { RedisService } from './redis.service';
import { AppConfig } from '../../config/app.config';
import { logger } from '../../shared/utils/logger';

/**
 * 2-Tier Cache Manager
 * L1: node-cache (로컬 메모리, 3초 TTL)
 * L2: Redis (공유 캐시, 60초 TTL)
 */
export class CacheManager {
  private l1Cache: NodeCache;
  private redisService: RedisService;

  constructor() {
    // L1 캐시 초기화
    this.l1Cache = new NodeCache({
      stdTTL: AppConfig.cache.l1Ttl,
      checkperiod: 1,
      useClones: false, // 성능 최적화
    });

    this.redisService = new RedisService();
    logger.info('Cache Manager initialized (2-tier)');
  }

  async get<T>(key: string): Promise<T | null> {
    // TODO: L1 캐시 확인
    // TODO: L1 미스 시 L2(Redis) 확인
    // TODO: L2 히트 시 L1에 저장
    // TODO: 둘 다 미스 시 null 반환
    
    throw new Error('Method not implemented');
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // TODO: L1, L2 양쪽에 저장
    
    throw new Error('Method not implemented');
  }

  async invalidate(key: string): Promise<void> {
    // TODO: L1, L2 양쪽에서 삭제
    // TODO: Redis Pub/Sub으로 다른 API 서버에 무효화 알림
    
    throw new Error('Method not implemented');
  }

  async invalidatePattern(pattern: string): Promise<void> {
    // TODO: 패턴 매칭으로 여러 키 무효화
    
    throw new Error('Method not implemented');
  }
}

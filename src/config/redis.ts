import { createClient, RedisClientType } from 'redis';
import { configManager } from './ConfigManager';
import { logger } from '../common/logger';

const { redisUrl } = configManager.get().system;

export const redis: RedisClientType = createClient({
  url: redisUrl || 'redis://localhost:6379'
}) as RedisClientType;

// Alias for convenience
export const redisClient: RedisClientType = redis;

export async function connectRedis() {
  try {
    if (!redis.isOpen) {
      await redis.connect();
      logger.info('✅ Redis 연결 성공');
    }
  } catch (error) {
    logger.error('❌ Redis 연결 실패:', error);
    throw error;
  }
}


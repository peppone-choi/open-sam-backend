import { createClient } from 'redis';

export const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Alias for convenience
export const redisClient = redis;

export async function connectRedis() {
  try {
    await redis.connect();
    console.log('✅ Redis 연결 성공');
  } catch (error) {
    console.error('❌ Redis 연결 실패:', error);
    throw error;
  }
}

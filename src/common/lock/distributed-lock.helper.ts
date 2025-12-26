import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { logger } from '../logger';
import { configManager } from '../../config/ConfigManager';

const { redisUrl } = configManager.get().system;

interface LockOptions {
  ttl?: number;
  retry?: number;
  retryDelayMs?: number;
  context?: string;
}

interface RunWithLockOptions extends LockOptions {
  throwOnFail?: boolean;
}

let redisClient: Redis | null = null;
const lockTokens = new Map<string, string>();

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  try {
    if (redisUrl) {
      redisClient = new Redis(redisUrl, {
        connectTimeout: 5000,
        enableOfflineQueue: true,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 200, 2000),
      });
    }
  } catch (error: any) {
    logger.error('[Lock] Failed to initialize Redis client', { error: error?.message });
    redisClient = null;
  }

  return redisClient;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function acquireDistributedLock(lockKey: string, options: LockOptions = {}): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    logger.warn('[Lock] Redis unavailable, skip locking', { lockKey, context: options.context });
    return false;
  }

  const ttl = options.ttl ?? 60;
  const retries = options.retry ?? 0;
  const retryDelayMs = options.retryDelayMs ?? 150;
  const context = options.context ?? 'global';

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const token = randomUUID();
      const result = await redis.set(lockKey, token, 'EX', ttl, 'NX');
      if (result === 'OK') {
        lockTokens.set(lockKey, token);
        logger.debug('[Lock] acquired distributed lock', { lockKey, ttl, context });
        return true;
      }
    } catch (error: any) {
      logger.error('[Lock] error acquiring distributed lock', {
        lockKey,
        context,
        error: error?.message,
      });
      break;
    }

    if (attempt < retries) await delay(retryDelayMs);
  }

  return false;
}

export async function releaseDistributedLock(lockKey: string, context?: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  const token = lockTokens.get(lockKey);
  const releaseScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  try {
    if (!token) {
      await redis.del(lockKey);
    } else {
      await redis.eval(releaseScript, 1, lockKey, token);
    }

    lockTokens.delete(lockKey);
    logger.debug('[Lock] released distributed lock', { lockKey, context });
  } catch (error: any) {
    logger.error('[Lock] failed to release distributed lock', {
      lockKey,
      context,
      error: error?.message,
    });
  }
}

export async function runWithDistributedLock<T>(
  lockKey: string,
  task: () => Promise<T>,
  options: RunWithLockOptions = {}
): Promise<T | null> {
  const acquired = await acquireDistributedLock(lockKey, options);
  if (!acquired) {
    if (options.throwOnFail) throw new Error(`Failed to acquire lock: ${lockKey}`);
    return null;
  }

  try {
    return await task();
  } finally {
    await releaseDistributedLock(lockKey, options.context);
  }
}

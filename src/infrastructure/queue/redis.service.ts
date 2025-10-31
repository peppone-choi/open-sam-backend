import Redis from 'ioredis';
import { logger } from '../../common/logger';

export class RedisService {
  private static instance: RedisService | null = null;
  private client: Redis | null = null;
  private isConnected = false;

  private constructor() {}

  static async connect(): Promise<RedisService> {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }

    if (!RedisService.instance.isConnected) {
      await RedisService.instance.initialize();
    }

    return RedisService.instance;
  }

  private async initialize(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError(err) {
        logger.warn('Redis reconnect on error', { error: err.message });
        return true;
      }
    });

    this.client.on('connect', () => {
      logger.info('Redis 연결 성공');
      this.isConnected = true;
    });

    this.client.on('error', (err) => {
      logger.error('Redis 에러', { error: err.message, stack: err.stack });
      this.isConnected = false;
    });

    this.client.on('close', () => {
      logger.warn('Redis 연결 종료');
      this.isConnected = false;
    });

    await this.waitForConnection();
  }

  private async waitForConnection(timeout = 5000): Promise<void> {
    const start = Date.now();
    while (!this.isConnected && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!this.isConnected) {
      throw new Error('Redis 연결 시간 초과');
    }
  }

  static async disconnect(): Promise<void> {
    if (RedisService.instance?.client) {
      await RedisService.instance.client.quit();
      RedisService.instance.isConnected = false;
      logger.info('Redis 연결 종료 완료');
    }
  }

  static getClient(): Redis {
    if (!RedisService.instance?.client) {
      throw new Error('Redis 클라이언트가 초기화되지 않았습니다. connect()를 먼저 호출하세요.');
    }
    return RedisService.instance.client;
  }

  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis 클라이언트가 초기화되지 않았습니다.');
    }
    return this.client;
  }
}

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
      connectTimeout: 10000,
      lazyConnect: false,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError(err) {
        // BUSYGROUP 오류는 재연결하지 않음 (Consumer Group이 이미 존재하는 경우)
        if (err.message?.includes('BUSYGROUP')) {
          logger.debug('Redis BUSYGROUP 오류 (Consumer Group이 이미 존재함)', { error: err.message });
          return false;
        }
        // 기타 오류는 재연결 시도
        logger.warn('Redis reconnect on error', { error: err.message });
        return true;
      },
      enableOfflineQueue: true
    });

    this.client.on('connect', () => {
      logger.info('Redis 연결 성공');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      logger.info('Redis 준비 완료');
      this.isConnected = true;
    });

    this.client.on('error', (err) => {
      logger.error('Redis 연결 에러', { error: err.message });
      this.isConnected = false;
    });

    this.client.on('close', () => {
      logger.warn('Redis 연결 종료');
      this.isConnected = false;
    });

    // ioredis는 자동으로 연결 시도를 시작하므로 ready 이벤트를 기다림
    await this.waitForReady();
  }

  private async waitForReady(timeout = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, timeout);

      if (this.client?.status === 'ready') {
        clearTimeout(timer);
        this.isConnected = true;
        resolve();
        return;
      }

      const onReady = () => {
        clearTimeout(timer);
        this.isConnected = true;
        this.client?.off('error', onError);
        resolve();
      };

      const onError = (err: Error) => {
        clearTimeout(timer);
        this.client?.off('ready', onReady);
        reject(err);
      };

      this.client?.once('ready', onReady);
      this.client?.once('error', onError);
    });
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

import Redis from 'ioredis';

/**
 * Redis 서비스 (L2 캐시 + Pub/Sub + Streams)
 */
export class RedisService {
  private client: Redis;
  private subscriber?: Redis;

  constructor() {
    // TODO: 환경변수에서 Redis URL 가져오기
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.client = new Redis(redisUrl);
    
    // TODO: 에러 핸들링
    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });
  }

  /**
   * 데이터 조회
   */
  async get<T>(key: string): Promise<T | null> {
    // TODO: 구현
    const data = await this.client.get(key);
    if (!data) return null;
    
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as unknown as T;
    }
  }

  /**
   * 데이터 저장
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // TODO: 구현
    const data = JSON.stringify(value);
    
    if (ttl) {
      await this.client.setex(key, ttl, data);
    } else {
      await this.client.set(key, data);
    }
  }

  /**
   * 데이터 삭제
   */
  async del(key: string): Promise<void> {
    // TODO: 구현
    await this.client.del(key);
  }

  /**
   * Pub/Sub 발행
   */
  async publish(channel: string, message: any): Promise<void> {
    // TODO: 구현
    const data = typeof message === 'string' ? message : JSON.stringify(message);
    await this.client.publish(channel, data);
  }

  /**
   * Pub/Sub 구독
   */
  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    // TODO: 구현
    if (!this.subscriber) {
      this.subscriber = this.client.duplicate();
    }
    
    this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        try {
          callback(JSON.parse(msg));
        } catch {
          callback(msg);
        }
      }
    });
  }

  /**
   * Redis Streams에 메시지 추가
   */
  async xadd(stream: string, data: Record<string, any>): Promise<string> {
    // TODO: 구현
    const fields: string[] = [];
    Object.entries(data).forEach(([key, value]) => {
      fields.push(key, typeof value === 'string' ? value : JSON.stringify(value));
    });
    
    return await this.client.xadd(stream, '*', ...fields);
  }

  /**
   * 연결 종료
   */
  async disconnect(): Promise<void> {
    await this.client.quit();
    if (this.subscriber) {
      await this.subscriber.quit();
    }
  }

  /**
   * 싱글톤 인스턴스 반환용
   */
  getClient(): Redis {
    return this.client;
  }
}

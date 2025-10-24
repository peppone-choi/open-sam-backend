import Redis from 'ioredis';

export class RedisService {
  private redis: Redis;
  private subscriber: Redis;

  constructor() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(url);
    this.subscriber = new Redis(url);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.redis.hgetall(key);
  }

  async hset(key: string, data: Record<string, any>): Promise<number> {
    return this.redis.hset(key, data);
  }

  async hincrby(key: string, field: string, value: number): Promise<number> {
    return this.redis.hincrby(key, field, value);
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ...args: any[]): Promise<string | null> {
    return this.redis.set(key, value, ...args);
  }

  async del(key: string): Promise<number> {
    return this.redis.del(key);
  }

  async xadd(stream: string, data: Record<string, any>): Promise<string> {
    return this.redis.xadd(stream, '*', 'payload', JSON.stringify(data)) as any;
  }

  async xreadgroup(
    group: string,
    consumer: string,
    streams: Record<string, string>,
    opts?: { COUNT?: number; BLOCK?: number }
  ): Promise<any> {
    // TODO: Implement xreadgroup
    return null;
  }

  async xack(stream: string, group: string, id: string): Promise<number> {
    return this.redis.xack(stream, group, id);
  }

  subscribe(channel: string, handler: (message: string) => void): void {
    this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, msg) => {
      if (ch === channel) handler(msg);
    });
  }

  async publish(channel: string, message: string): Promise<number> {
    return this.redis.publish(channel, message);
  }

  async scan(cursor: string, ...args: any[]): Promise<[string, string[]]> {
    return this.redis.scan(cursor, ...args);
  }

  async reservePCP(generalId: string, cost: number): Promise<boolean> {
    const script = `
      local key = KEYS[1]
      local cost = tonumber(ARGV[1])
      local pcp = tonumber(redis.call('HGET', key, 'pcp') or 0)
      if pcp >= cost then
        redis.call('HINCRBY', key, 'pcp', -cost)
        return 1
      else
        return 0
      end
    `;
    
    const result = await this.redis.eval(
      script,
      1,
      `state:general:${generalId}`,
      cost
    ) as number;
    
    return result === 1;
  }
}

import { logger } from '../common/utils/logger';
import { EntityRepository } from '../../common/repository/entity-repository';
import { RedisService } from '../../infrastructure/cache/redis.service';

/**
 * Persist Scheduler (Entity 기반)
 * 
 * Redis dirty flag가 있는 Entity를 MongoDB에 영속화
 * 5분마다 실행
 */
export class PersistScheduler {
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;
  private redis: RedisService;

  constructor() {
    this.redis = new RedisService();
  }

  start() {
    this.isRunning = true;
    logger.info('💾 Persist Scheduler 시작 (Entity 기반)');
    
    this.intervalId = setInterval(() => {
      this.persist();
    }, 300000); // 5분
  }

  stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    logger.info('⏸️  Persist Scheduler 중지');
  }

  private async persist() {
    try {
      const client = this.redis.getClient();
      
      // Redis에서 dirty flag가 있는 Entity 조회
      const dirtyKeys = await this.scanDirtyEntities();
      
      logger.info(`💾 영속화 시작: ${dirtyKeys.length}개 Entity`);

      let successCount = 0;

      for (const key of dirtyKeys) {
        try {
          // Redis에서 Entity 데이터 조회
          const data = await client.hgetall(key);
          
          if (!data || !data.id || !data.role || !data.scenario) {
            continue;
          }

          // MongoDB에 저장
          const entity = this.deserialize(data);
          await EntityRepository.update({ role: entity.role, id: entity.id, scenario: entity.scenario }, entity);

          // dirty flag 제거
          await client.hdel(key, 'dirty');
          
          successCount++;
        } catch (error) {
          logger.error(`Entity 영속화 실패 (${key}):`, error);
        }
      }

      logger.info(`✅ 영속화 완료: ${successCount}/${dirtyKeys.length}`);
    } catch (error) {
      logger.error('영속화 오류:', error);
    }
  }

  /**
   * Dirty Entity 키 스캔
   */
  private async scanDirtyEntities(): Promise<string[]> {
    const client = this.redis.getClient();
    const dirtyKeys: string[] = [];
    let cursor = '0';

    // entity:* 패턴으로 스캔
    do {
      const result = await client.scan(cursor, 'MATCH', 'entity:*', 'COUNT', '100');
      cursor = result[0];
      const keys = result[1];

      for (const key of keys) {
        const dirty = await client.hget(key, 'dirty');
        if (dirty === '1' || dirty === 'true') {
          dirtyKeys.push(key);
        }
      }
    } while (cursor !== '0');

    return dirtyKeys;
  }

  /**
   * Redis 데이터 역직렬화
   */
  private deserialize(data: Record<string, string>): any {
    const result: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      // JSON 파싱 시도
      if (value.startsWith('{') || value.startsWith('[')) {
        try {
          result[key] = JSON.parse(value);
        } catch {
          result[key] = value;
        }
      }
      // 숫자 변환
      else if (!isNaN(Number(value)) && value !== '') {
        result[key] = Number(value);
      }
      // 문자열
      else {
        result[key] = value;
      }
    }
    
    return result;
  }
}

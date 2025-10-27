import cron from 'node-cron';

import { logger } from '../common/utils/logger';
import { RedisService } from '../../infrastructure/cache/redis.service';

export class PersistScheduler {
  private redis = new RedisService();

  start() {
    cron.schedule('*/5 * * * *', async () => {
      await this.flush();
    });

    logger.info('📅 영속화 스케줄러 시작 완료 (5분마다 실행)');
  }

  private async flush() {
    logger.info('🔄 영속화 플러시 시작 중...');
    const startTime = Date.now();

    try {
      // TODO: 1. 더티 키 스캔 (version > persistedVersion)
      const dirtyKeys = await this.scanDirtyKeys();
      
      logger.info(`변경된 키 ${dirtyKeys.length}개 발견`);

      // TODO: 2. 배치 저장
      for (const key of dirtyKeys) {
        await this.persistKey(key);
      }

      const elapsed = Date.now() - startTime;
      logger.info(`✅ 영속화 플러시 완료 (키=${dirtyKeys.length}개, 소요시간=${elapsed}ms)`);

    } catch (error) {
      logger.error('영속화 플러시 오류:', error);
    }
  }

  private async scanDirtyKeys(): Promise<string[]> {
    const keys: string[] = [];
    // TODO: Implement scan for dirty keys (version > persistedVersion)
    return keys;
  }

  private async persistKey(key: string): Promise<void> {
    try {
      // TODO: Parse key (state:general:{id})
      // TODO: Load state from Redis
      // TODO: Save to MongoDB
      // TODO: Update persistedVersion in Redis
    } catch (error) {
      logger.error(`${key} 영속화 실패:`, error);
    }
  }
}

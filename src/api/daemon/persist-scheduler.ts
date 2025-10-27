import cron from 'node-cron';

import { logger } from '../common/utils/logger';
import { RedisService } from '../../infrastructure/cache/redis.service';

export class PersistScheduler {
  private redis = new RedisService();

  start() {
    cron.schedule('*/5 * * * *', async () => {
      await this.flush();
    });

    logger.info('📅 Persist scheduler started (every 5 minutes)');
  }

  private async flush() {
    logger.info('🔄 Starting persist flush...');
    const startTime = Date.now();

    try {
      // TODO: 1. 더티 키 스캔 (version > persistedVersion)
      const dirtyKeys = await this.scanDirtyKeys();
      
      logger.info(`Found ${dirtyKeys.length} dirty keys`);

      // TODO: 2. 배치 저장
      for (const key of dirtyKeys) {
        await this.persistKey(key);
      }

      const elapsed = Date.now() - startTime;
      logger.info(`✅ Persist flush complete (keys=${dirtyKeys.length}, time=${elapsed}ms)`);

    } catch (error) {
      logger.error('Persist flush error:', error);
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
      logger.error(`Failed to persist ${key}:`, error);
    }
  }
}

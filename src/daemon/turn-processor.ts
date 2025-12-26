import { mongoConnection } from '../db/connection';
import { logger } from '../common/logger';
import { CachePreloaderService } from '../services/cache/CachePreloader.service';
import { TurnScheduler } from './turn-scheduler';
import { configManager } from '../config/ConfigManager';

const { daemon, timeouts } = configManager.get();

let scheduler: TurnScheduler | null = null;

export async function startTurnProcessor() {
  if (!mongoConnection.getStatus()) {
    await mongoConnection.connect();
  }
  
  logger.info('[Turn Processor] Preloading game data into cache...');
  try {
    await CachePreloaderService.preloadAllSessions();
    logger.info('[Turn Processor] ✅ Cache preload completed');
  } catch (error: any) {
    logger.error('[Turn Processor] ⚠️ Cache preload failed, continuing anyway:', error);
  }
  
  const runImmediately = daemon.runImmediately;
  const schedulerOptions = {
    pollIntervalMs: daemon.turnIntervalMs,
    maxConcurrentSessions: daemon.turnProcessorConcurrency,
    jitterMs: 5000, // 기본값
  };
  
  scheduler = new TurnScheduler(schedulerOptions);
  await scheduler.start({ runImmediately });
  logger.info('[Turn Processor] Daemon started successfully', schedulerOptions);
}
 
export function stopTurnProcessor() {
  scheduler?.stop();
  scheduler = null;
  logger.info('[Turn Processor] Daemon stopped');
}
 
if (require.main === module) {
  startTurnProcessor().catch(err => {
    logger.error('[Turn Processor] Failed to start:', err);
    process.exit(1);
  });
}

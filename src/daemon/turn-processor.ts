import dotenv from 'dotenv';
dotenv.config();

import { mongoConnection } from '../db/connection';
import { logger } from '../common/logger';
import { CachePreloaderService } from '../services/cache/CachePreloader.service';
import { TurnScheduler } from './turn-scheduler';

const PROCESS_INTERVAL_MS = parseInt(process.env.TURN_PROCESSOR_INTERVAL_MS || '1000', 10);

let scheduler: TurnScheduler | null = null;

export async function startTurnProcessor() {
  if (!mongoConnection.getStatus()) {
    await mongoConnection.connect(process.env.MONGODB_URI);
  }
  
  logger.info('[Turn Processor] Preloading game data into cache...');
  try {
    await CachePreloaderService.preloadAllSessions();
    logger.info('[Turn Processor] ✅ Cache preload completed');
  } catch (error: any) {
    logger.error('[Turn Processor] ⚠️ Cache preload failed, continuing anyway:', error);
  }
  
  const runImmediately = process.env.TURN_PROCESSOR_RUN_IMMEDIATELY !== 'false';
  const schedulerOptions = {
    pollIntervalMs: parseInt(process.env.TURN_SCHEDULER_POLL_MS || String(PROCESS_INTERVAL_MS * 30), 10),
    maxConcurrentSessions: parseInt(process.env.TURN_SCHEDULER_MAX_CONCURRENCY || '3', 10),
    jitterMs: parseInt(process.env.TURN_SCHEDULER_JITTER_MS || '5000', 10),
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
    console.error('[Turn Processor] Failed to start:', err);
    process.exit(1);
  });
}

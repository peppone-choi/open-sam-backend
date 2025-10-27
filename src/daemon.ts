import dotenv from 'dotenv';
import { mongoConnection } from './db/connection';
import { GameLoop } from './api/daemon/game-loop';
import { CommandProcessor } from './api/daemon/command-processor';
import { PersistScheduler } from './api/daemon/persist-scheduler';
import { logger } from './api/common/utils/logger';
import { getCommandQueue, getCommandRepository, getGeneralRepository } from './container';

dotenv.config();

async function start() {
  try {
    // MongoDB 연결
    await mongoConnection.connect(process.env.MONGODB_URI!);
    logger.info('✅ MongoDB connected');

    // Repository 초기화
    const commandRepo = getCommandRepository();
    const generalRepo = getGeneralRepository();
    logger.info('✅ Repositories initialized');

    // CommandQueue 초기화
    const commandQueue = getCommandQueue();
    logger.info('✅ Command Queue initialized');

    // Game Loop 시작 (1초 tick)
    const gameLoop = new GameLoop();
    gameLoop.start();
    logger.info('✅ Game Loop started (1s tick)');

    // Command Processor 시작 (Redis Streams 소비)
    const processor = new CommandProcessor(commandRepo, generalRepo);
    await processor.start();
    logger.info('✅ Command Processor started');

    // Persist Scheduler 시작 (5분마다)
    const scheduler = new PersistScheduler();
    scheduler.start();
    logger.info('✅ Persist Scheduler started (5min interval)');

    logger.info('');
    logger.info('🚀 Game Daemon is running!');
    logger.info('📍 Game Loop: 1s tick');
    logger.info('📍 Command Processor: Redis Streams consumer');
    logger.info('📍 Persist Scheduler: 5min interval');
    logger.info('');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('\n🛑 Shutting down...');
      gameLoop.stop();
      processor.stop();
      scheduler.stop();
      await mongoConnection.disconnect();
      logger.info('✅ Daemon stopped');
      process.exit(0);
    });

  } catch (error) {
    logger.error('❌ Failed to start daemon:', error);
    process.exit(1);
  }
}

start();

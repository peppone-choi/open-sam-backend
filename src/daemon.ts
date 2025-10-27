import dotenv from 'dotenv';
import { mongoConnection } from './db/connection';
import { GameLoop } from './api/daemon/game-loop';
import { CommandProcessor } from './api/daemon/command-processor';
import { PersistScheduler } from './api/daemon/persist-scheduler';
import { logger } from './api/common/utils/logger';
import { getCommandQueue } from './container';

dotenv.config();

async function start() {
  try {
    // TODO: MongoDB 연결
    await mongoConnection.connect(process.env.MONGODB_URI!);

    // TODO: CommandQueue 초기화
    const commandQueue = getCommandQueue();
    logger.info('✅ Command Queue initialized');

    // TODO: Game Loop 시작 (100ms tick)
    const gameLoop = new GameLoop();
    gameLoop.start();

    // TODO: Command Processor 시작 (Redis Streams 소비)
    const processor = new CommandProcessor();
    await processor.start();

    // TODO: Persist Scheduler 시작 (5분마다)
    const scheduler = new PersistScheduler();
    scheduler.start();

    logger.info('✅ Game Daemon started');
    logger.info('📍 Game Loop: 100ms tick');
    logger.info('📍 Command Processor: Redis Streams consumer');
    logger.info('📍 Persist Scheduler: 5min interval');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('\n🛑 Shutting down...');
      gameLoop.stop();
      processor.stop();
      await mongoConnection.disconnect();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start daemon:', error);
    process.exit(1);
  }
}

start();

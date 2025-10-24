import dotenv from 'dotenv';
import { mongoConnection } from './infrastructure/db/connection';
import { GameLoop } from './daemon/game-loop';
import { CommandProcessor } from './daemon/command-processor';
import { PersistScheduler } from './daemon/persist-scheduler';
import { logger } from './common/utils/logger';

dotenv.config();

async function start() {
  try {
    // TODO: MongoDB 연결
    await mongoConnection.connect(process.env.MONGODB_URI!);

    // TODO: Game Loop 시작
    const gameLoop = new GameLoop();
    gameLoop.start();

    // TODO: Command Processor 시작
    const processor = new CommandProcessor();
    await processor.start();

    // TODO: Persist Scheduler 시작
    const scheduler = new PersistScheduler();
    scheduler.start();

    logger.info('✅ Game Daemon started');

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

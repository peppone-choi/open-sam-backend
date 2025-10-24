import 'reflect-metadata';
import { getPrismaClient } from '../infrastructure/database/prisma-client';
import { GameLoop } from './game-loop';
import { CommandProcessor } from './command-processor';
import { logger } from '../shared/utils/logger';

/**
 * Game Daemon - 단일 Writer 프로세스
 * 역할:
 * 1. Redis Streams에서 커맨드 읽기 (XREADGROUP)
 * 2. 커맨드 실행 (DB 쓰기)
 * 3. 게임 루프 (100ms) - 턴 진행, 전투 처리 등
 */
async function bootstrap() {
  try {
    logger.info('🎮 Game Daemon starting...');

    // Prisma 연결
    const prisma = getPrismaClient();
    await prisma.$connect();
    logger.info('Database connected');

    // TODO: Redis 연결
    // TODO: DI Container 초기화

    // Command Processor 시작
    const commandProcessor = new CommandProcessor();
    commandProcessor.start();

    // Game Loop 시작 (100ms interval)
    const gameLoop = new GameLoop();
    gameLoop.start();

    logger.info('✅ Game Daemon started successfully');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down Game Daemon');
      commandProcessor.stop();
      gameLoop.stop();
      await prisma.$disconnect();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start Game Daemon:', error);
    process.exit(1);
  }
}

bootstrap();

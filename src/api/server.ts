import { createApp } from './app';
import { AppConfig } from '../config/app.config';
import { getPrismaClient } from '../infrastructure/database/prisma-client';
import { logger } from '../shared/utils/logger';

async function bootstrap() {
  try {
    // Prisma 연결 확인
    const prisma = getPrismaClient();
    await prisma.$connect();
    logger.info('Database connected');

    // TODO: Redis 연결
    // TODO: DI Container 초기화 (tsyringe)

    // Express 앱 생성
    const app = createApp();

    // 서버 시작
    const server = app.listen(AppConfig.port, () => {
      logger.info(`🚀 API Server started on port ${AppConfig.port}`);
      logger.info(`Environment: ${AppConfig.nodeEnv}`);
      logger.info(`Health check: http://localhost:${AppConfig.port}/health`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();

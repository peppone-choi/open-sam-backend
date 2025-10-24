import { PrismaClient } from '@prisma/client';
import { logger } from '../../shared/utils/logger';

// Singleton Prisma Client
let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ],
    });

    // 쿼리 로깅
    prisma.$on('query' as never, (e: any) => {
      logger.debug('Query: ' + e.query);
    });

    prisma.$on('error' as never, (e: any) => {
      logger.error('DB Error: ' + e.message);
    });

    logger.info('Prisma Client initialized');
  }

  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Prisma Client disconnected');
  }
}

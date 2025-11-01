import dotenv from 'dotenv';
import { mongoConnection } from './db/connection';
import { logger } from './common/logger';
import { CommandRegistry } from './core/command';
import { CommandExecutor } from './core/command/CommandExecutor';

dotenv.config();

/**
 * Game Daemon
 * 
 * Redis Streams에서 커맨드를 소비하고 실행하는 단일 Writer 프로세스입니다.
 * CQRS 패턴의 Write 부분을 담당합니다.
 */

let isShuttingDown = false;

async function start() {
  try {
    logger.info('Game Daemon 시작 중...', {
      nodeEnv: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      hostname: process.env.HOSTNAME || 'daemon-1'
    });

    // MongoDB 연결
    await mongoConnection.connect(process.env.MONGODB_URI);
    logger.info('MongoDB 연결 성공');

    // Redis 연결
    const { RedisService } = await import('./infrastructure/queue/redis.service');
    await RedisService.connect();
    logger.info('Redis 연결 성공');

    // 커맨드 레지스트리 초기화
    await CommandRegistry.loadAll();
    const commandStats = CommandRegistry.getStats();
    logger.info('커맨드 시스템 초기화 완료', commandStats);

    // CommandQueue 초기화
    const { CommandQueue } = await import('./infrastructure/queue/command-queue');
    const queue = new CommandQueue('game:commands');
    await queue.init();
    logger.info('CommandQueue 초기화 완료');

    logger.info('🎮 Game Daemon 시작 완료!', {
      totalCommands: commandStats.total,
      streamName: 'game:commands',
      consumerGroup: 'cmd-group'
    });

    // 커맨드 소비 시작
    const consumerName = process.env.HOSTNAME || 'daemon-1';
    
    while (!isShuttingDown) {
      try {
        await queue.consume('cmd-group', consumerName, async (message) => {
          const { commandId, category, type, generalId, sessionId, arg } = message;

          logger.info('커맨드 수신', {
            commandId,
            category,
            type,
            generalId
          });

          try {
            // 커맨드 실행
            const result = await CommandExecutor.execute({
              category: category as 'general' | 'nation',
              type,
              generalId,
              sessionId,
              arg
            });

            logger.info('커맨드 실행 완료', {
              commandId,
              success: result.success
            });

            // TODO: 결과를 Command 문서에 업데이트
            // await commandRepository.updateById(commandId, {
            //   status: 'completed',
            //   result: result.result,
            //   completed_at: new Date()
            // });

          } catch (error) {
            logger.error('커맨드 실행 실패', {
              commandId,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined
            });

            // TODO: 실패 상태 업데이트
            // await commandRepository.updateById(commandId, {
            //   status: 'failed',
            //   error: error.message,
            //   completed_at: new Date()
            // });
          }
        });
      } catch (error) {
        if (!isShuttingDown) {
          logger.error('커맨드 소비 에러', {
            error: error instanceof Error ? error.message : String(error)
          });
          // 잠시 대기 후 재시도
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

  } catch (error) {
    logger.error('Game Daemon 시작 실패', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(signal: string) {
  logger.info('Shutdown 신호 수신', { signal });
  isShuttingDown = true;

  try {
    // MongoDB 연결 종료
    await mongoConnection.disconnect();
    logger.info('MongoDB 연결 종료');

    // Redis 연결 종료
    const { RedisService } = await import('./infrastructure/queue/redis.service');
    await RedisService.disconnect();
    logger.info('Redis 연결 종료');

    logger.info('Game Daemon 정상 종료');
    process.exit(0);
  } catch (error) {
    logger.error('Shutdown 중 에러', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

// 프로세스 에러 핸들링
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('처리되지 않은 Promise 거부', {
    reason: String(reason),
    promise: String(promise)
  });
});

process.on('uncaughtException', (error) => {
  logger.error('처리되지 않은 예외', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

start();

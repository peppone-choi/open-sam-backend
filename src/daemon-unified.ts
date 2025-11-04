import dotenv from 'dotenv';
dotenv.config();

import * as cron from 'node-cron';
import { mongoConnection } from './db/connection';
import { logger } from './common/logger';
import { CommandRegistry } from './core/command';
import { CommandExecutor } from './core/command/CommandExecutor';
import { Session } from './models/session.model';
import { ExecuteEngineService } from './services/global/ExecuteEngine.service';

/**
 * 통합 게임 데몬
 * 
 * 1. 턴 스케줄링 (크론 기반) - 매분마다 게임 턴 처리
 * 2. 커맨드 소비 (Redis Streams) - 비동기 커맨드 실행
 * 
 * 두 가지 역할을 하나의 프로세스에서 처리합니다.
 */

let isShuttingDown = false;

/**
 * 턴 처리 함수 (크론)
 */
async function processTurns() {
  try {
    const sessions = await (Session as any).find({ 'data.isunited': { $nin: [2, 3] } });
    
    for (const session of sessions) {
      const sessionId = session.session_id;
      
      try {
        const result = await ExecuteEngineService.execute({ session_id: sessionId });
        
        if (result.updated) {
          logger.info(`Turn processed for session ${sessionId}`, {
            nextTurntime: result.turntime
          });
        } else if (result.locked) {
          logger.debug(`Session ${sessionId} is locked by another instance`);
        }
      } catch (error: any) {
        logger.error(`Turn processing error for session ${sessionId}`, {
          error: error.message,
          stack: error.stack
        });
      }
    }
  } catch (error: any) {
    logger.error('Fatal error in turn processor', {
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * 메인 시작 함수
 */
async function start() {
  try {
    logger.info('🚀 통합 게임 데몬 시작 중...', {
      nodeEnv: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      hostname: process.env.HOSTNAME || 'daemon-unified-1'
    });

    // MongoDB 연결
    await mongoConnection.connect(process.env.MONGODB_URI);
    logger.info('✅ MongoDB 연결 성공');

    // Redis 연결
    const { RedisService } = await import('./infrastructure/queue/redis.service');
    await RedisService.connect();
    logger.info('✅ Redis 연결 성공');

    // 커맨드 레지스트리 초기화
    await CommandRegistry.loadAll();
    const commandStats = CommandRegistry.getStats();
    logger.info('✅ 커맨드 시스템 초기화 완료', commandStats);

    // CommandQueue 초기화
    const { CommandQueue } = await import('./infrastructure/queue/command-queue');
    const queue = new CommandQueue('game:commands');
    await queue.init();
    logger.info('✅ CommandQueue 초기화 완료');

    // 1. 크론 스케줄러 시작 (턴 처리)
    const CRON_EXPRESSION = '* * * * *'; // 매분
    cron.schedule(CRON_EXPRESSION, () => {
      processTurns().catch(err => {
        logger.error('크론 작업 실행 중 오류', {
          error: err.message,
          stack: err.stack
        });
      });
    });
    logger.info('✅ 턴 스케줄러 시작', { schedule: CRON_EXPRESSION });

    // 2. Redis Streams 커맨드 소비 시작
    const consumerName = process.env.HOSTNAME || 'daemon-unified-1';
    
    logger.info('🎮 통합 게임 데몬 시작 완료!', {
      features: {
        turnScheduler: true,
        commandConsumer: true
      },
      totalCommands: commandStats.total,
      streamName: 'game:commands',
      consumerGroup: 'cmd-group',
      cronSchedule: CRON_EXPRESSION
    });

    // 커맨드 소비 루프
    while (!isShuttingDown) {
      try {
        await queue.consume('cmd-group', consumerName, async (message) => {
          const { commandId, category, type, generalId, sessionId, arg } = message;

          logger.info('📥 커맨드 수신', {
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

            logger.info('✅ 커맨드 실행 완료', {
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
            logger.error('❌ 커맨드 실행 실패', {
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
    logger.error('🔥 통합 게임 데몬 시작 실패', {
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
  logger.info('🛑 Shutdown 신호 수신', { signal });
  isShuttingDown = true;

  try {
    // MongoDB 연결 종료
    await mongoConnection.disconnect();
    logger.info('MongoDB 연결 종료');

    // Redis 연결 종료
    const { RedisService } = await import('./infrastructure/queue/redis.service');
    await RedisService.disconnect();
    logger.info('Redis 연결 종료');

    logger.info('✅ 통합 게임 데몬 정상 종료');
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

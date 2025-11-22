// @ts-nocheck - Type issues need investigation
import dotenv from 'dotenv';
dotenv.config();

import * as cron from 'node-cron';
import { Gin7StrategicLoopService } from './services/logh/Gin7StrategicLoop.service';

/**
 * 통합 게임 데몬
 * 
 * 1. 턴 스케줄링 (크론 기반) - 매분마다 게임 턴 처리
 * 2. 커맨드 소비 (Redis Streams) - 비동기 커맨드 실행
 * 
 * 두 가지 역할을 하나의 프로세스에서 처리합니다.
 * 
 * 최적화: 세션 상태 업데이트 직후 락 해제 (운영자 수정 대기 시간 최소화)
 */

let isShuttingDown = false;

// 동적 임포트를 위한 전역 변수
let mongoConnection: any;
let logger: any;
let CommandRegistry: any;
let CommandExecutor: any;
let Session: any;
let ExecuteEngineService: any;
let processAuction: any;
let processTournament: any;
let gin7Loop: Gin7StrategicLoopService | null = null;

/**
 * 턴 처리 함수 (크론)
 */
async function processTurns() {
  try {
    if (gin7Loop) {
      gin7Loop.stop();
      gin7Loop = null;
    }
    // MongoDB 연결 종료

    await mongoConnection.disconnect();
    logger.info('MongoDB 연결 종료');

    // Redis 연결 종료
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

// 이 파일이 직접 실행될 때만 start() 호출
// ts-node-dev에서도 작동하도록 개선
if (require.main === module || process.argv[1]?.includes('daemon-unified')) {
  start().catch(err => {
    console.error('❌ 데몬 시작 실패:', err);
    process.exit(1);
  });
}

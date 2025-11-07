import dotenv from 'dotenv';
dotenv.config();

import { ExecuteEngineService } from '../services/global/ExecuteEngine.service';
import { Session } from '../models/session.model';
import { mongoConnection } from '../db/connection';
import { getSocketManager } from '../socket/socketManager';
import { logger } from '../common/logger';

// 실행 간격 (밀리초) - 기본값: 10초
const PROCESS_INTERVAL_MS = parseInt(process.env.TURN_PROCESSOR_INTERVAL_MS || '10000', 10);

async function processTurns() {
  try {
    // 활성 세션 조회 (status가 'running'이고 isunited가 2,3이 아닌 경우)
    const sessions = await Session.find({ 
      $or: [
        { status: 'running' },
        { 'data.status': { $ne: 'paused' } }
      ],
      $and: [
        {
          $or: [
            { 'data.isunited': { $exists: false } },
            { 'data.isunited': { $nin: [2, 3] } }
          ]
        }
      ]
    });
    
    if (sessions.length === 0) {
      logger.debug('[Turn Processor] No active sessions to process');
      return;
    }

    logger.info(`[Turn Processor] Processing ${sessions.length} session(s)`);
    
    for (const session of sessions) {
      const sessionId = session.session_id;
      const sessionData = session.data || {};
      
      // 세션이 실행 중인지 확인
      if (session.status === 'paused' || sessionData.status === 'paused') {
        logger.debug(`[Turn Processor] Session ${sessionId}: Paused, skipping`);
        continue;
      }
      
      try {
        const result = await ExecuteEngineService.execute({ session_id: sessionId });
        
        if (result.success && result.updated) {
          logger.info(`[Turn Processor] Session ${sessionId}: Turn processed, next turntime=${result.turntime}`);
          
          // Socket.IO로 턴 완료 브로드캐스트 (ExecuteEngine에서 이미 브로드캐스트하므로 중복 방지)
        } else if (result.locked) {
          logger.debug(`[Turn Processor] Session ${sessionId}: Locked (another instance processing)`);
        } else if (!result.updated) {
          logger.debug(`[Turn Processor] Session ${sessionId}: No turns to process (turntime=${result.turntime})`);
        }
      } catch (error: any) {
        logger.error(`[Turn Processor] Session ${sessionId}: Error`, {
          error: error.message,
          stack: error.stack
        });
      }
    }
  } catch (error: any) {
    logger.error('[Turn Processor] Fatal error', {
      error: error.message,
      stack: error.stack
    });
  }
}

let processorInterval: NodeJS.Timeout | null = null;

export async function startTurnProcessor() {
  // MongoDB 연결 확인
  if (!mongoConnection.getStatus()) {
    await mongoConnection.connect(process.env.MONGODB_URI);
  }
  
  const intervalSeconds = PROCESS_INTERVAL_MS / 1000;
  logger.info(`[Turn Processor] Starting with interval: ${intervalSeconds}s (${PROCESS_INTERVAL_MS}ms)`);
  
  // 즉시 한 번 실행 (선택적)
  const runImmediately = process.env.TURN_PROCESSOR_RUN_IMMEDIATELY !== 'false';
  if (runImmediately) {
    logger.info('[Turn Processor] Running immediately on start');
    processTurns().catch(err => {
      logger.error('[Turn Processor] Error in initial run:', err);
    });
  }
  
  // setInterval로 주기적 실행
  processorInterval = setInterval(() => {
    processTurns().catch(err => {
      logger.error('[Turn Processor] Unexpected error in processor:', err);
    });
  }, PROCESS_INTERVAL_MS);
  
  logger.info('[Turn Processor] Daemon started successfully');
}

// 서버 내장 모드에서 사용할 수 있는 함수
export function stopTurnProcessor() {
  if (processorInterval) {
    clearInterval(processorInterval);
    processorInterval = null;
    logger.info('[Turn Processor] Daemon stopped');
  }
}

if (require.main === module) {
  startTurnProcessor().catch(err => {
    console.error('[Turn Processor] Failed to start:', err);
    process.exit(1);
  });
}

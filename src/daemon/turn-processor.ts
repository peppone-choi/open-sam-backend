import dotenv from 'dotenv';
dotenv.config();

import * as cron from 'node-cron';
import { ExecuteEngineService } from '../services/global/ExecuteEngine.service';
import { Session } from '../models/session.model';
import { mongoConnection } from '../db/connection';
import { getSocketManager } from '../socket/socketManager';
import { logger } from '../common/logger';

const CRON_EXPRESSION = process.env.TURN_PROCESSOR_CRON || '* * * * *'; // 기본값: 매분

async function processTurns() {
  try {
    const sessions = await (Session as any).find({ 
      'data.isunited': { $nin: [2, 3] },
      'data.status': { $ne: 'paused' }
    });
    
    if (sessions.length === 0) {
      return;
    }

    logger.info(`[Turn Processor] Processing ${sessions.length} session(s)`);
    
    for (const session of sessions) {
      const sessionId = session.session_id;
      
      try {
        const result = await ExecuteEngineService.execute({ session_id: sessionId });
        
        if (result.success && result.updated) {
          logger.info(`[Turn Processor] Session ${sessionId}: Turn processed, next turntime=${result.turntime}`);
          
          // Socket.IO로 턴 완료 브로드캐스트
          const socketManager = getSocketManager();
          if (socketManager && result.turntime) {
            const nextTurnAt = new Date(result.turntime);
            const sessionData = session.data || {};
            const turnNumber = (sessionData.year || 180) * 12 + (sessionData.month || 1);
            
            socketManager.broadcastTurnComplete(sessionId, turnNumber, nextTurnAt);
          }
        } else if (result.locked) {
          logger.debug(`[Turn Processor] Session ${sessionId}: Locked (another instance processing)`);
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

export async function startTurnProcessor() {
  // MongoDB 연결 확인
  if (!mongoConnection.isConnected()) {
    await mongoConnection.connect(process.env.MONGODB_URI);
  }
  
  logger.info(`[Turn Processor] Starting with schedule: ${CRON_EXPRESSION}`);
  
  // 즉시 한 번 실행 (선택적)
  const runImmediately = process.env.TURN_PROCESSOR_RUN_IMMEDIATELY === 'true';
  if (runImmediately) {
    logger.info('[Turn Processor] Running immediately on start');
    processTurns().catch(err => {
      logger.error('[Turn Processor] Error in initial run:', err);
    });
  }
  
  // Cron 스케줄 설정
  cron.schedule(CRON_EXPRESSION, () => {
    processTurns().catch(err => {
      logger.error('[Turn Processor] Unexpected error in cron job:', err);
    });
  });
  
  logger.info('[Turn Processor] Daemon started successfully');
}

// 서버 내장 모드에서 사용할 수 있는 함수
export function stopTurnProcessor() {
  // cron 작업은 자동으로 종료되므로 특별한 정리 작업이 필요 없음
  logger.info('[Turn Processor] Daemon stopped');
}

if (require.main === module) {
  startTurnProcessor().catch(err => {
    console.error('[Turn Processor] Failed to start:', err);
    process.exit(1);
  });
}

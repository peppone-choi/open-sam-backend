import dotenv from 'dotenv';
import * as cron from 'node-cron';
import { Model } from 'mongoose';

dotenv.config();

import { connectDB } from '../config/db';
import { Session, ISession } from '../models/session.model';
import { logger } from '../common/logger';
import { processAuction } from '../services/auction/AuctionEngine.service';
import { KVStorage } from '../utils/KVStorage';

const SessionModel = Session as Model<ISession>;

/**
 * 분산 락을 사용하여 경매 처리 중복 방지
 */
async function processAuctionsOnce(): Promise<void> {
  const lockKey = 'auction_processor_lock';
  const lockTTL = 50000; // 50초 (크론 주기보다 짧게)
  
  try {
    // 전역 락 획득 시도
    const globalLock = KVStorage.getStorage('global_locks');
    const lockAcquired = await globalLock.acquireLock(lockKey, lockTTL);
    
    if (!lockAcquired) {
      logger.debug('[AuctionProcessor] Another instance is processing, skipping');
      return;
    }

    const sessions = await SessionModel.find({ 'data.isunited': { $nin: [2, 3] } });
    
    for (const session of sessions) {
      const sessionId = session.session_id;
      const sessionLockKey = `auction_processing:${sessionId}`;
      
      try {
        // 세션별 락 획득
        const sessionLock = KVStorage.getStorage(`locks:${sessionId}`);
        const sessionLockAcquired = await sessionLock.acquireLock(sessionLockKey, 30000);
        
        if (!sessionLockAcquired) {
          logger.debug(`[AuctionProcessor] Session ${sessionId} is already being processed`);
          continue;
        }

        await processAuction(sessionId);
        
        // 세션 락 해제
        await sessionLock.releaseLock(sessionLockKey);
      } catch (error: any) {
        logger.error(`[AuctionProcessor] Session ${sessionId} 처리 중 오류`, {
          error: error.message,
          stack: error.stack,
        });
        
        // 오류 발생 시에도 락 해제
        try {
          const sessionLock = KVStorage.getStorage(`locks:${sessionId}`);
          await sessionLock.releaseLock(sessionLockKey);
        } catch (unlockError: any) {
          logger.error(`[AuctionProcessor] Failed to release lock for ${sessionId}`, {
            error: unlockError.message
          });
        }
      }
    }
    
    // 전역 락 해제
    await globalLock.releaseLock(lockKey);
  } catch (error: any) {
    logger.error('[AuctionProcessor] Fatal error in processAuctionsOnce', {
      error: error.message,
      stack: error.stack
    });
  }
}

export async function startAuctionProcessor(): Promise<void> {
  await connectDB();
  logger.info('[AuctionProcessor] DB 연결 완료');

  await processAuctionsOnce();
  cron.schedule('* * * * *', () => {
    processAuctionsOnce().catch((error) => {
      logger.error('[AuctionProcessor] 크론 작업 실패', {
        error: error.message,
        stack: error.stack,
      });
    });
  });
  logger.info('[AuctionProcessor] 경매 처리 스케줄러 시작 (매 분)');
}

if (require.main === module) {
  startAuctionProcessor().catch((error) => {
    console.error('[AuctionProcessor] 프로세서 시작 실패', error);
    process.exit(1);
  });
}

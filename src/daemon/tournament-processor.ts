import dotenv from 'dotenv';
import * as cron from 'node-cron';
import { Model } from 'mongoose';

dotenv.config();

import { connectDB } from '../config/db';
import { Session, ISession } from '../models/session.model';
import { logger } from '../common/logger';
import { processTournament } from '../services/tournament/TournamentEngine.service';
import { acquireDistributedLock, releaseDistributedLock } from '../common/lock/distributed-lock.helper';

const SessionModel = Session as Model<ISession>;

/**
 * 토너먼트 자동 진행 처리
 * 경매 처리와 유사하게 분산 락을 사용하여 중복 처리 방지
 */
async function processTournamentsOnce(): Promise<void> {
  const sessions = await SessionModel.find({ 'data.isunited': { $nin: [2, 3] } });
  
  for (const session of sessions) {
    const sessionId = session.session_id;
    const lockKey = `lock:tournament:${sessionId}`;
    
    const acquired = await acquireDistributedLock(lockKey, {
      ttl: 55,
      retry: 2,
      retryDelayMs: 300,
      context: 'tournament-processor',
    });

    if (!acquired) {
      logger.debug('[TournamentProcessor] Skip session because tournament lock is held elsewhere', { sessionId });
      continue;
    }

    try {
      await processTournament(sessionId);
    } catch (error: any) {
      logger.error(`[TournamentProcessor] Session ${sessionId} 처리 중 오류`, {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      await releaseDistributedLock(lockKey, 'tournament-processor');
    }
  }
}

export async function startTournamentProcessor(): Promise<void> {
  await connectDB();
  logger.info('[TournamentProcessor] DB 연결 완료');

  // 초기 실행
  await processTournamentsOnce();
  
  // 매 분마다 실행
  cron.schedule('* * * * *', () => {
    processTournamentsOnce().catch((error) => {
      logger.error('[TournamentProcessor] 크론 작업 실패', {
        error: error.message,
        stack: error.stack,
      });
    });
  });
  
  logger.info('[TournamentProcessor] 토너먼트 처리 스케줄러 시작 (매 분)');
}

if (require.main === module) {
  startTournamentProcessor().catch((error) => {
    console.error('[TournamentProcessor] 프로세서 시작 실패', error);
    process.exit(1);
  });
}

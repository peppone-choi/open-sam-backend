import dotenv from 'dotenv';
import * as cron from 'node-cron';
import { Model } from 'mongoose';

dotenv.config();

import { connectDB } from '../config/db';
import { Session, ISession } from '../models/session.model';
import { logger } from '../common/logger';
import { processAuction } from '../services/auction/AuctionEngine.service';

const SessionModel = Session as Model<ISession>;

async function processAuctionsOnce(): Promise<void> {
  const sessions = await SessionModel.find({ 'data.isunited': { $nin: [2, 3] } });
  for (const session of sessions) {
    const sessionId = session.session_id;
    try {
      await processAuction(sessionId);
    } catch (error: any) {
      logger.error(`[AuctionProcessor] Session ${sessionId} 처리 중 오류`, {
        error: error.message,
        stack: error.stack,
      });
    }
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

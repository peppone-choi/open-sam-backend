import * as cron from 'node-cron';
import { connectDB } from '../config/db';
import { scanSyncQueue, getSyncQueueItem, removeFromSyncQueue } from '../common/cache/sync-queue.helper';
import { Session } from '../models/session.model';
import { General } from '../models/general.model';
import { City } from '../models/city.model';
import { Nation } from '../models/nation.model';
import { logger } from '../common/logger';

/**
 * CQRS 패턴 - DB 동기화 데몬
 * 
 * 주기적으로 Redis의 변경사항을 MongoDB에 동기화합니다.
 * - Command: Redis에만 쓰기
 * - Query: L1 → L2 → DB 읽기
 * - Sync: 주기적으로 Redis → DB 동기화
 */
const SYNC_INTERVAL = '*/30 * * * * *'; // 30초마다

/**
 * Redis → DB 동기화 실행
 */
async function syncToDatabase() {
  try {
    const queueItems = await scanSyncQueue();
    
    if (queueItems.length === 0) {
      return;
    }

    logger.debug(`[DB Sync] ${queueItems.length}개 항목 동기화 시작`);

    for (const item of queueItems) {
      try {
        const queueData = await getSyncQueueItem(item.key);
        
        if (!queueData || !queueData.data) {
          // 큐 데이터가 없으면 이미 처리되었거나 만료됨
          await removeFromSyncQueue(item.key);
          continue;
        }

        const { type, data } = queueData;

        // 타입별로 DB에 저장
        switch (type) {
          case 'session': {
            await (Session as any).findOneAndUpdate(
              { session_id: data.session_id },
              { $set: data },
              { upsert: true }
            );
            logger.debug(`[DB Sync] Session 동기화: ${data.session_id}`);
            break;
          }

          case 'general': {
            const sessionId = data.session_id || data.data?.session_id;
            const generalId = data.generalId || data.no || data.data?.no;
            
            if (sessionId && generalId) {
              await (General as any).findOneAndUpdate(
                { session_id: sessionId, 'data.no': generalId },
                { $set: data },
                { upsert: true }
              );
              logger.debug(`[DB Sync] General 동기화: ${sessionId}:${generalId}`);
            }
            break;
          }

          case 'city': {
            const sessionId = data.session_id || data.data?.session_id;
            const cityId = data.city || data.cityId;
            
            if (sessionId && cityId) {
              await (City as any).findOneAndUpdate(
                { session_id: sessionId, city: cityId },
                { $set: data },
                { upsert: true }
              );
              logger.debug(`[DB Sync] City 동기화: ${sessionId}:${cityId}`);
            }
            break;
          }

          case 'nation': {
            const sessionId = data.session_id || data.data?.session_id;
            const nationId = data.nation || data.nationId;
            
            if (sessionId && nationId) {
              await (Nation as any).findOneAndUpdate(
                { session_id: sessionId, nation: nationId },
                { $set: data },
                { upsert: true }
              );
              logger.debug(`[DB Sync] Nation 동기화: ${sessionId}:${nationId}`);
            }
            break;
          }
        }

        // 동기화 완료 후 큐에서 제거
        await removeFromSyncQueue(item.key);
      } catch (error: any) {
        logger.error(`[DB Sync] 항목 동기화 실패: ${item.key}`, {
          error: error.message,
          type: item.type,
          id: item.id
        });
        // 실패해도 큐에서 제거하지 않음 (재시도 가능)
      }
    }
  } catch (error: any) {
    logger.error('[DB Sync] 동기화 프로세스 실패', {
      error: error.message
    });
  }
}

/**
 * DB 동기화 데몬 시작
 */
export async function startDbSyncProcessor() {
  await connectDB();
  
  logger.info(`[DB Sync] 동기화 데몬 시작 (스케줄: ${SYNC_INTERVAL})`);
  
  cron.schedule(SYNC_INTERVAL, () => {
    syncToDatabase().catch(err => {
      logger.error('[DB Sync] 예상치 못한 에러', err);
    });
  });
  
  // 즉시 한 번 실행
  syncToDatabase().catch(err => {
    logger.error('[DB Sync] 초기 동기화 실패', err);
  });
  
  logger.info('[DB Sync] 데몬 시작 완료');
}

if (require.main === module) {
  startDbSyncProcessor().catch(err => {
    logger.error('[DB Sync] 데몬 시작 실패', err);
    process.exit(1);
  });
}


import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { mongoConnection } from '../db/connection';
import { logger } from '../common/logger';
// 모든 모델 import
import '../models/session.model';
import '../models/general.model';
import '../models/city.model';
import '../models/nation.model';
import '../models/troop.model';
import '../models/nation-env.model';
import '../models/general_turn.model';
import '../models/nation_turn.model';
import '../models/diplomacy.model';
import '../models/ng_diplomacy.model';
import '../models/command.model';
import '../models/battle-action.model';
import '../models/battle-instance.model';
import '../models/board.model';
import '../models/comment.model';
import '../models/event.model';
import '../models/general-log.model';
import '../models/general_access_log.model';
import '../models/general_record.model';
import '../models/hall.model';
import '../models/KVStorage.model';
import '../models/message.model';
import '../models/ng_auction_bid.model';
import '../models/ng_betting.model';
import '../models/plock.model';
import '../models/rank_data.model';
import '../models/select_npc_token.model';
import '../models/select_pool.model';
import '../models/statistic.model';
import '../models/user.model';
import '../models/vote.model';
import '../models/vote_comment.model';
import '../models/world_history.model';

/**
 * 게임 데이터 영속화 데몬
 * 
 * Redis나 메모리의 모든 게임 데이터를 주기적으로 MongoDB에 강제 저장합니다.
 * Mongoose의 Schema.Types.Mixed는 자동으로 변경 감지를 하지 않으므로,
 * markModified()를 호출하여 명시적으로 변경 사항을 표시해야 합니다.
 * 
 * 이 데몬은 ExecuteEngine이나 다른 서비스에서 markModified를 빠뜨리는 경우를 대비한 안전장치입니다.
 */

// 실행 간격 (밀리초) - 기본값: 5분
const PERSIST_INTERVAL_MS = parseInt(process.env.DATA_PERSIST_INTERVAL_MS || '300000', 10);

// Mixed 타입 data 필드를 가진 모든 모델명
const MODELS_TO_PERSIST = [
  'Session',
  'General',
  'City',
  'Nation',
  'Troop',
  'NationEnv',
  'GeneralTurn',
  'NationTurn',
  'Diplomacy',
  'Command',
  'BattleAction',
  'BattleInstance',
  'Board',
  'Comment',
  'Event',
  'GeneralLog',
  'GeneralAccessLog',
  'GeneralRecord',
  'Hall',
  'KVStorage',
  'Message',
  'NgAuctionBid',
  'NgBetting',
  'NgDiplomacy',
  'Plock',
  'RankData',
  'SelectNpcToken',
  'SelectPool',
  'Statistic',
  'User',
  'Vote',
  'VoteComment',
  'WorldHistory'
];

/**
 * 특정 모델의 모든 문서를 영속화
 */
async function persistModel(modelName: string, sessionIds: string[]) {
  try {
    const Model = mongoose.models[modelName];
    if (!Model) {
      logger.warn(`[Data Persister] Model not found: ${modelName}`);
      return 0;
    }

    let totalSaved = 0;

    for (const sessionId of sessionIds) {
      try {
        // session_id 필드가 있는 모델만 필터링
        const docs = await Model.find({
          session_id: sessionId,
          data: { $exists: true }
        });

        let savedCount = 0;
        for (const doc of docs) {
          try {
            if (doc.data) {
              doc.markModified('data');
              await doc.save();
              savedCount++;
            }
          } catch (error: any) {
            logger.error(`[Data Persister] Failed to save ${modelName} doc:`, {
              sessionId,
              error: error.message
            });
          }
        }

        totalSaved += savedCount;
        if (savedCount > 0) {
          logger.debug(`[Data Persister] Saved ${savedCount} ${modelName} docs for session: ${sessionId}`);
        }
      } catch (error: any) {
        // session_id 필드가 없는 모델은 건너뛰기
        if (error.message?.includes('session_id')) {
          logger.debug(`[Data Persister] ${modelName} does not have session_id field, skipping`);
        } else {
          logger.error(`[Data Persister] Failed to persist ${modelName} for session: ${sessionId}`, {
            error: error.message
          });
        }
      }
    }

    return totalSaved;
  } catch (error: any) {
    logger.error(`[Data Persister] Fatal error in persist${modelName}`, {
      error: error.message
    });
    return 0;
  }
}

/**
 * session_id가 없는 전역 모델들 영속화 (KVStorage, User 등)
 */
async function persistGlobalModels() {
  try {
    const globalModels = ['KVStorage', 'User'];
    let totalSaved = 0;

    for (const modelName of globalModels) {
      try {
        const Model = mongoose.models[modelName];
        if (!Model) continue;

        const docs = await Model.find({ data: { $exists: true } });

        let savedCount = 0;
        for (const doc of docs) {
          try {
            if (doc.data) {
              doc.markModified('data');
              await doc.save();
              savedCount++;
            }
          } catch (error: any) {
            logger.error(`[Data Persister] Failed to save global ${modelName} doc:`, {
              error: error.message
            });
          }
        }

        totalSaved += savedCount;
        if (savedCount > 0) {
          logger.debug(`[Data Persister] Saved ${savedCount} global ${modelName} docs`);
        }
      } catch (error: any) {
        logger.error(`[Data Persister] Failed to persist global ${modelName}`, {
          error: error.message
        });
      }
    }

    if (totalSaved > 0) {
      logger.info(`[Data Persister] Persisted ${totalSaved} global model doc(s)`);
    }
  } catch (error: any) {
    logger.error('[Data Persister] Fatal error in persistGlobalModels', {
      error: error.message
    });
  }
}

/**
 * 모든 활성 세션과 관련 데이터를 MongoDB에 저장
 */
async function persistAllData() {
  try {
    // 활성 세션 조회
    const Session = mongoose.models.Session;
    if (!Session) {
      logger.error('[Data Persister] Session model not found');
      return;
    }

    const sessions = await Session.find({
      $or: [
        { status: 'running' },
        { 'data.status': { $ne: 'paused' } }
      ]
    });

    if (sessions.length === 0) {
      logger.debug('[Data Persister] No active sessions to persist');
      return;
    }

    logger.info(`[Data Persister] Starting persistence for ${sessions.length} session(s)`);

    const sessionIds: string[] = [];
    let sessionSavedCount = 0;

    // 1. 먼저 세션 데이터 저장
    for (const session of sessions) {
      try {
        if (session.data) {
          session.markModified('data');
          await session.save();
          sessionSavedCount++;
          sessionIds.push(session.session_id);

          logger.debug(`[Data Persister] Saved session: ${session.session_id}`, {
            year: session.data?.year,
            month: session.data?.month,
            turntime: session.data?.turntime
          });
        }
      } catch (error: any) {
        logger.error(`[Data Persister] Failed to save session: ${session.session_id}`, {
          error: error.message
        });
      }
    }

    logger.info(`[Data Persister] Persisted ${sessionSavedCount}/${sessions.length} session(s)`);

    // 2. 모든 모델 병렬 영속화
    if (sessionIds.length > 0) {
      const startTime = Date.now();
      
      const results = await Promise.allSettled(
        MODELS_TO_PERSIST
          .filter(model => model !== 'Session') // Session은 이미 저장했으므로 제외
          .map(modelName => persistModel(modelName, sessionIds))
      );

      let totalDocs = 0;
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          totalDocs += result.value;
        } else {
          logger.error(`[Data Persister] Failed to persist ${MODELS_TO_PERSIST[index + 1]}:`, {
            error: result.reason
          });
        }
      });

      const elapsed = Date.now() - startTime;
      logger.info(`[Data Persister] Persisted ${totalDocs} document(s) from ${MODELS_TO_PERSIST.length - 1} models in ${elapsed}ms`);
    }

    // 3. 전역 모델 영속화
    await persistGlobalModels();

    logger.info('[Data Persister] Persistence cycle completed successfully');
  } catch (error: any) {
    logger.error('[Data Persister] Fatal error in persistAllData', {
      error: error.message,
      stack: error.stack
    });
  }
}

let persisterInterval: NodeJS.Timeout | null = null;

export async function startSessionPersister() {
  // MongoDB 연결 확인
  if (!mongoConnection.getStatus()) {
    await mongoConnection.connect(process.env.MONGODB_URI);
  }

  const intervalMinutes = Math.floor(PERSIST_INTERVAL_MS / 60000);
  const intervalSeconds = Math.floor((PERSIST_INTERVAL_MS % 60000) / 1000);
  logger.info(`[Data Persister] Starting with interval: ${intervalMinutes}m ${intervalSeconds}s (${PERSIST_INTERVAL_MS}ms)`);
  logger.info(`[Data Persister] Monitoring ${MODELS_TO_PERSIST.length} model types`);

  // 즉시 한 번 실행 (선택적)
  const runImmediately = process.env.DATA_PERSIST_RUN_IMMEDIATELY !== 'false';
  if (runImmediately) {
    logger.info('[Data Persister] Running immediately on start');
    await persistAllData().catch(err => {
      logger.error('[Data Persister] Error in initial run:', err);
    });
  }

  // setInterval로 주기적 실행
  persisterInterval = setInterval(async () => {
    try {
      await persistAllData();
    } catch (err) {
      logger.error('[Data Persister] Unexpected error:', err);
    }
  }, PERSIST_INTERVAL_MS);

  logger.info('[Data Persister] Daemon started successfully');
}

// 서버 내장 모드에서 사용할 수 있는 함수
export function stopSessionPersister() {
  if (persisterInterval) {
    clearInterval(persisterInterval);
    persisterInterval = null;
    logger.info('[Data Persister] Daemon stopped');
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('[Data Persister] SIGTERM received, saving all data before shutdown...');
  stopSessionPersister();
  await persistAllData();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('[Data Persister] SIGINT received, saving all data before shutdown...');
  stopSessionPersister();
  await persistAllData();
  process.exit(0);
});

if (require.main === module) {
  startSessionPersister().catch(err => {
    console.error('[Data Persister] Failed to start:', err);
    process.exit(1);
  });
}

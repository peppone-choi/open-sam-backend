import mongoose from 'mongoose';
import { mongoConnection } from '../db/connection';
import { logger } from '../common/logger';
import { configManager } from '../config/ConfigManager';

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

const { daemon, timeouts } = configManager.get();

// 실행 간격 (밀리초)
const PERSIST_INTERVAL_MS = timeouts.autoSave;

// Mixed 타입 data 필드를 가진 모든 모델명
const MODELS_TO_PERSIST = [
  'Session', 'General', 'City', 'Nation', 'Troop', 'NationEnv', 
  'GeneralTurn', 'NationTurn', 'Diplomacy', 'Command', 
  'BattleAction', 'BattleInstance', 'Board', 'Comment', 
  'Event', 'GeneralLog', 'GeneralAccessLog', 'GeneralRecord', 
  'Hall', 'KVStorage', 'Message', 'NgAuctionBid', 'NgBetting', 
  'NgDiplomacy', 'Plock', 'RankData', 'SelectNpcToken', 
  'SelectPool', 'Statistic', 'User', 'Vote', 'VoteComment', 'WorldHistory'
];

async function persistModel(modelName: string, sessionIds: string[]) {
  try {
    const Model = mongoose.models[modelName];
    if (!Model) return 0;

    let totalSaved = 0;
    for (const sessionId of sessionIds) {
      try {
        const docs = await Model.find({ session_id: sessionId, data: { $exists: true } });
        let savedCount = 0;
        for (const doc of docs) {
          if (doc.data) {
            doc.markModified('data');
            await doc.save();
            savedCount++;
          }
        }
        totalSaved += savedCount;
      } catch (e) {}
    }
    return totalSaved;
  } catch (error) {
    return 0;
  }
}

async function persistGlobalModels() {
  const globalModels = ['KVStorage', 'User'];
  let totalSaved = 0;
  for (const modelName of globalModels) {
    try {
      const Model = mongoose.models[modelName];
      if (!Model) continue;
      const docs = await Model.find({ data: { $exists: true } });
      for (const doc of docs) {
        if (doc.data) {
          doc.markModified('data');
          await doc.save();
          totalSaved++;
        }
      }
    } catch (e) {}
  }
  return totalSaved;
}

async function persistAllData() {
  try {
    const Session = mongoose.models.Session;
    if (!Session) return;

    const sessions = await Session.find({
      $or: [{ status: 'running' }, { 'data.status': { $ne: 'paused' } }]
    });

    if (sessions.length === 0) return;

    const sessionIds: string[] = [];
    for (const session of sessions) {
      if (session.data) {
        session.markModified('data');
        await session.save();
        sessionIds.push(session.session_id);
      }
    }

    if (sessionIds.length > 0) {
      await Promise.allSettled(
        MODELS_TO_PERSIST
          .filter(model => model !== 'Session')
          .map(modelName => persistModel(modelName, sessionIds))
      );
    }

    await persistGlobalModels();
    logger.info('[Data Persister] Persistence cycle completed');
  } catch (error: any) {
    logger.error('[Data Persister] Fatal error:', error.message);
  }
}

let persisterInterval: NodeJS.Timeout | null = null;

export async function startSessionPersister() {
  if (!mongoConnection.getStatus()) {
    await mongoConnection.connect();
  }

  persisterInterval = setInterval(async () => {
    await persistAllData();
  }, PERSIST_INTERVAL_MS);

  logger.info('[Data Persister] Daemon started');
}

export function stopSessionPersister() {
  if (persisterInterval) {
    clearInterval(persisterInterval);
    persisterInterval = null;
  }
}

if (require.main === module) {
  startSessionPersister().catch(err => {
    logger.error('[Data Persister] Failed to start:', err);
    process.exit(1);
  });
}

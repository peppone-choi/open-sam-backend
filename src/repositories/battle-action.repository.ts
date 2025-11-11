// @ts-nocheck
import { BattleAction } from '../models/battle-action.model';
import { DeleteResult } from 'mongodb';

/**
 * 전투 액션 리포지토리
 */
class BattleActionRepository {
  async findBySession(sessionId: string) {
    return BattleAction.find({ session_id: sessionId });
  }

  async findByBattle(sessionId: string, battleId: string) {
    return BattleAction.find({ 
      session_id: sessionId, 
      battle_id: battleId 
    }).sort({ turn: 1 });
  }

  async create(data: any) {
    return BattleAction.create(data);
  }

  async deleteBySession(sessionId: string): Promise<DeleteResult> {
    return BattleAction.deleteMany({ session_id: sessionId });
  }
}

export const battleActionRepository = new BattleActionRepository();

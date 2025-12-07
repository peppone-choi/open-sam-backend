import mongoose, { Model } from 'mongoose';
import { Battle, IBattle } from '../../models/battle.model';
import { BattleLog, IBattleLog } from '../../models/battle-log.model';

export class ReplayService {
  /**
   * 전투 종료 후 리플레이 데이터 저장
   */
  static async saveReplay(battleId: string): Promise<IBattleLog | null> {
    try {
      const battleModel = Battle as Model<IBattle>;
      const battleLogModel = BattleLog as Model<IBattleLog>;

      const battle = await battleModel.findOne({ battleId });
      if (!battle) {
        console.error(`Replay save failed: Battle ${battleId} not found`);
        return null;
      }

      // 이미 존재하는지 확인
      const existingLog = await battleLogModel.findOne({ battleId });
      if (existingLog) {
        return existingLog;
      }

      // BattleLog 생성
      const replay = await battleLogModel.create({
        battleId: battle.battleId,
        session_id: battle.session_id,
        attackerNationId: battle.attackerNationId,
        defenderNationId: battle.defenderNationId,
        winner: battle.winner,
        map: battle.map,
        initialAttackerUnits: battle.initialAttackerUnits || [],
        initialDefenderUnits: battle.initialDefenderUnits || [],
        turnHistory: battle.turnHistory,
        totalTurns: battle.currentTurn
      });

      console.log(`Replay saved for battle ${battleId}`);
      return replay;

    } catch (error) {
      console.error('Error saving replay:', error);
      return null;
    }
  }

  /**
   * 리플레이 조회
   */
  static async getReplay(battleId: string): Promise<IBattleLog | null> {
    const battleLogModel = BattleLog as Model<IBattleLog>;
    return await battleLogModel.findOne({ battleId });
  }
}

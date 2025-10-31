import { Battle } from '../../models/battle.model';

export class GetBattleHistoryService {
  static async execute(data: any, user?: any) {
    const { battleId } = data;

    try {
      if (!battleId) {
        return { success: false, message: 'battleId가 필요합니다' };
      }

      const battle = await Battle.findOne({ battleId });

      if (!battle) {
        return { success: false, message: '전투를 찾을 수 없습니다' };
      }

      return {
        success: true,
        history: battle.turnHistory.map(turn => ({
          turnNumber: turn.turnNumber,
          timestamp: turn.timestamp,
          actions: turn.actions,
          results: turn.results,
          battleLog: turn.battleLog
        }))
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

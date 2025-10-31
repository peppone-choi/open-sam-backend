import { Battle } from '../../models/battle.model';

export class GetBattleStateService {
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
        battle: {
          battleId: battle.battleId,
          status: battle.status,
          currentPhase: battle.currentPhase,
          currentTurn: battle.currentTurn,
          maxTurns: battle.maxTurns,
          attackerNationId: battle.attackerNationId,
          defenderNationId: battle.defenderNationId,
          targetCityId: battle.targetCityId,
          terrain: battle.terrain,
          attackerUnits: battle.attackerUnits,
          defenderUnits: battle.defenderUnits,
          readyPlayers: battle.readyPlayers,
          winner: battle.winner,
          startedAt: battle.startedAt,
          completedAt: battle.completedAt,
          planningTimeLimit: battle.planningTimeLimit,
          resolutionTimeLimit: battle.resolutionTimeLimit
        }
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

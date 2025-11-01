import { Battle, BattleStatus, BattlePhase } from '../../models/battle.model';

export class ReadyUpService {
  static async execute(data: any, user?: any) {
    const { battleId, generalId } = data;

    try {
      if (!battleId || !generalId) {
        return { success: false, message: '필수 파라미터가 누락되었습니다' };
      }

      const battle = await Battle.findOne({ battleId });

      if (!battle) {
        return { success: false, message: '전투를 찾을 수 없습니다' };
      }

      if (battle.status !== BattleStatus.IN_PROGRESS) {
        return { success: false, message: '전투가 진행 중이 아닙니다' };
      }

      if (battle.currentPhase !== BattlePhase.PLANNING) {
        return { success: false, message: 'Planning 단계가 아닙니다' };
      }

      if (!battle.readyPlayers.includes(generalId)) {
        battle.readyPlayers.push(generalId);
      }

      const allGeneralIds = [
        ...battle.attackerUnits.map(u => u.generalId),
        ...battle.defenderUnits.map(u => u.generalId)
      ];

      const allReady = allGeneralIds.every(id => battle.readyPlayers.includes(id));

      await battle.save();

      return {
        success: true,
        message: 'Ready-Up 완료',
        allReady,
        readyPlayers: battle.readyPlayers
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

import { Battle, BattleStatus } from '../../models/battle.model';

export class DeployUnitsService {
  static async execute(data: any, user?: any) {
    const { battleId, generalId, position } = data;

    try {
      if (!battleId || !generalId || !position) {
        return { success: false, message: '필수 파라미터가 누락되었습니다' };
      }

      const battle = await Battle.findOne({ battleId });

      if (!battle) {
        return { success: false, message: '전투를 찾을 수 없습니다' };
      }

      if (battle.status !== BattleStatus.DEPLOYING) {
        return { success: false, message: '배치 단계가 아닙니다' };
      }

      const allUnits = [...battle.attackerUnits, ...battle.defenderUnits];
      const unit = allUnits.find(u => u.generalId === generalId);

      if (!unit) {
        return { success: false, message: '해당 장수를 찾을 수 없습니다' };
      }

      unit.position = { x: position.x, y: position.y };

      await battle.save();

      return {
        success: true,
        message: '배치 완료',
        position: unit.position
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

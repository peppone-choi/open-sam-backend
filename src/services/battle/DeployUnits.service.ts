import { BattleStatus } from '../../models/battle.model';
import { battleRepository } from '../../repositories/battle.repository';

export class DeployUnitsService {
  static async execute(data: any, user?: any) {
    const { battleId, unitId, x, y } = data;

    try {
      if (!battleId || !unitId || x === undefined || y === undefined) {
        return { success: false, message: '필수 파라미터가 누락되었습니다' };
      }

      const battle = await battleRepository.findByBattleId(battleId);

      if (!battle) {
        return { success: false, message: '전투를 찾을 수 없습니다' };
      }

      if (battle.status !== BattleStatus.DEPLOYING) {
        return { success: false, message: '배치 단계가 아닙니다' };
      }

      const generalId = parseInt(unitId);
      const allUnits = [...battle.attackerUnits, ...battle.defenderUnits];
      const unit = allUnits.find(u => u.generalId === generalId);

      if (!unit) {
        return { success: false, message: '해당 장수를 찾을 수 없습니다' };
      }

      // 위치 유효성 검증
      if (x < 0 || x >= 40 || y < 0 || y >= 40) {
        return { success: false, message: '유효하지 않은 위치입니다 (0-39 범위)' };
      }

      // 해당 위치에 다른 유닛이 있는지 확인
      const hasOtherUnit = allUnits.some(
        u => u.position && u.position.x === x && u.position.y === y && u.generalId !== generalId
      );

      if (hasOtherUnit) {
        return { success: false, message: '해당 위치에 이미 다른 유닛이 있습니다' };
      }

      unit.position = { x, y };

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

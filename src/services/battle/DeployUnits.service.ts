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

      // 위치 유효성 검증 (800 x 600 맵)
      if (x < 0 || x >= battle.map.width || y < 0 || y >= battle.map.height) {
        return { success: false, message: `유효하지 않은 위치입니다 (0-${battle.map.width} x 0-${battle.map.height} 범위)` };
      }

      // 배치 영역 검증
      const isAttacker = battle.attackerUnits.some(u => u.generalId === generalId);
      const zone = isAttacker ? battle.map.attackerZone : battle.map.defenderZone;

      if (x < zone.x[0] || x > zone.x[1] || y < zone.y[0] || y > zone.y[1]) {
        return { 
          success: false, 
          message: `배치 영역을 벗어났습니다 (x: ${zone.x[0]}-${zone.x[1]}, y: ${zone.y[0]}-${zone.y[1]})` 
        };
      }

      // 해당 위치에 다른 유닛이 있는지 확인 (충돌 반경 고려)
      const tooClose = allUnits.some(u => {
        if (u.generalId === generalId) return false;
        if (!u.position) return false;
        
        const dx = u.position.x - x;
        const dy = u.position.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = u.collisionRadius + unit.collisionRadius;
        
        return distance < minDistance;
      });

      if (tooClose) {
        return { success: false, message: '다른 유닛과 너무 가깝습니다' };
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

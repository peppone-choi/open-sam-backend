import { BattleStatus, BattlePhase, ITurnAction } from '../../models/battle.model';
import { UnitType } from '../../core/battle-calculator';
import { battleRepository } from '../../repositories/battle.repository';

/**
 * 병종별 이동 거리 (셀 단위)
 */
const UNIT_MOVEMENT_RANGE: Record<UnitType, number> = {
  [UnitType.FOOTMAN]: 3,
  [UnitType.ARCHER]: 4,
  [UnitType.CAVALRY]: 5,
  [UnitType.WIZARD]: 3,
  [UnitType.SIEGE]: 2,
};

/**
 * 병종별 공격 사거리 (셀 단위)
 */
const UNIT_ATTACK_RANGE: Record<UnitType, number> = {
  [UnitType.FOOTMAN]: 1,
  [UnitType.ARCHER]: 4,
  [UnitType.CAVALRY]: 2,
  [UnitType.WIZARD]: 3,
  [UnitType.SIEGE]: 5,
};

/**
 * 맨하탄 거리 계산
 */
function getManhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

export class SubmitActionService {
  static async execute(data: any, user?: any) {
    const { battleId, generalId, action, target, targetGeneralId, skillId } = data;

    try {
      if (!battleId || !generalId || !action) {
        return { success: false, message: '필수 파라미터가 누락되었습니다' };
      }

      const battle = await battleRepository.findByBattleId(battleId);

      if (!battle) {
        return { success: false, message: '전투를 찾을 수 없습니다' };
      }

      if (battle.status !== BattleStatus.IN_PROGRESS) {
        return { success: false, message: '전투가 진행 중이 아닙니다' };
      }

      if (battle.currentPhase !== BattlePhase.PLANNING) {
        return { success: false, message: '명령 입력 단계가 아닙니다' };
      }

      const allUnits = [...battle.attackerUnits, ...battle.defenderUnits];
      const unit = allUnits.find(u => u.generalId === generalId);

      if (!unit) {
        return { success: false, message: '해당 장수를 찾을 수 없습니다' };
      }

      // 위치 검증
      if (!unit.position) {
        return { success: false, message: '유닛이 배치되지 않았습니다' };
      }

      // 이동/공격 명령 검증
      if (action === 'move' || action === 'attack') {
        if (!target || target.x === undefined || target.y === undefined) {
          return { success: false, message: '목표 위치가 필요합니다' };
        }

        const distance = getManhattanDistance(
          unit.position.x,
          unit.position.y,
          target.x,
          target.y
        );

        if (action === 'move') {
          const maxRange = UNIT_MOVEMENT_RANGE[unit.unitType] || 3;
          if (distance > maxRange) {
            return {
              success: false,
              message: `이동 거리를 초과했습니다 (최대 ${maxRange}칸, 현재 ${distance}칸)`,
            };
          }

          // 다른 유닛이 있는지 확인
          const hasOtherUnit = allUnits.some(
            u => u.position &&
            u.position.x === target.x &&
            u.position.y === target.y &&
            u.generalId !== generalId
          );

          if (hasOtherUnit) {
            return { success: false, message: '다른 유닛이 있는 위치로 이동할 수 없습니다' };
          }
        }

        if (action === 'attack') {
          const maxRange = UNIT_ATTACK_RANGE[unit.unitType] || 1;
          if (distance > maxRange) {
            return {
              success: false,
              message: `공격 사거리를 초과했습니다 (최대 ${maxRange}칸, 현재 ${distance}칸)`,
            };
          }

          // 타겟 유닛 확인
          const targetUnit = allUnits.find(
            u => u.position &&
            u.position.x === target.x &&
            u.position.y === target.y &&
            u.generalId !== generalId
          );

          if (!targetUnit) {
            return { success: false, message: '공격할 유닛이 없습니다' };
          }

          // 아군 체크
          const isAttacker = battle.attackerUnits.some(u => u.generalId === generalId);
          const isTargetAttacker = battle.attackerUnits.some(u => u.generalId === targetUnit.generalId);
          
          if (isAttacker === isTargetAttacker) {
            return { success: false, message: '아군을 공격할 수 없습니다' };
          }
        }
      }

      const turnAction: ITurnAction = {
        generalId,
        action,
        target,
        targetGeneralId,
        skillId
      };

      const existingIndex = battle.currentTurnActions.findIndex(
        a => a.generalId === generalId
      );

      if (existingIndex >= 0) {
        battle.currentTurnActions[existingIndex] = turnAction;
      } else {
        battle.currentTurnActions.push(turnAction);
      }

      await battle.save();

      return {
        success: true,
        message: '액션 제출 완료',
        action: turnAction
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

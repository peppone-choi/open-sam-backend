import { Battle, BattleStatus, BattlePhase, ITurnAction } from '../../models/battle.model';

export class SubmitActionService {
  static async execute(data: any, user?: any) {
    const { battleId, generalId, action, target, targetGeneralId, skillId } = data;

    try {
      if (!battleId || !generalId || !action) {
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
        return { success: false, message: '명령 입력 단계가 아닙니다' };
      }

      const allUnits = [...battle.attackerUnits, ...battle.defenderUnits];
      const unit = allUnits.find(u => u.generalId === generalId);

      if (!unit) {
        return { success: false, message: '해당 장수를 찾을 수 없습니다' };
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

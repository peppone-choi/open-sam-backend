import { Battle, BattleStatus, BattlePhase } from '../../models/battle.model';

export class ReadyUpService {
  static async execute(data: any, user?: any) {
    const { battleId, ready } = data;

    try {
      if (!battleId || ready === undefined) {
        return { success: false, message: '필수 파라미터가 누락되었습니다' };
      }

      const battle = await (Battle as any).findOne({ battleId });

      if (!battle) {
        return { success: false, message: '전투를 찾을 수 없습니다' };
      }

      if (battle.status !== BattleStatus.IN_PROGRESS) {
        return { success: false, message: '전투가 진행 중이 아닙니다' };
      }

      if (battle.currentPhase !== BattlePhase.PLANNING) {
        return { success: false, message: 'Planning 단계가 아닙니다' };
      }

      // user에서 generalId 추출 (임시로 모든 유닛의 generalId 사용)
      // 실제로는 user 정보에서 확인해야 함
      const allGeneralIds = [
        ...battle.attackerUnits.map(u => u.generalId),
        ...battle.defenderUnits.map(u => u.generalId)
      ];

      // 모든 장수에 대해 ready 상태 토글 (임시 구현)
      // 실제로는 현재 사용자의 generalId만 처리해야 함
      if (ready) {
        // 모든 장수를 ready로 설정
        battle.readyPlayers = [...allGeneralIds];
      } else {
        battle.readyPlayers = [];
      }

      const allReady = allGeneralIds.every(id => battle.readyPlayers.includes(id));

      await battle.save();

      return {
        success: true,
        message: ready ? 'Ready-Up 완료' : 'Ready-Up 취소',
        allReady,
        readyPlayers: battle.readyPlayers
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

import { BattleStatus, BattlePhase } from '../../models/battle.model';
import { battleRepository } from '../../repositories/battle.repository';
import { ResolveTurnService } from './ResolveTurn.service';

export class ReadyUpService {
  static async execute(data: any, user?: any) {
    const { battleId, generalId } = data;

    try {
      if (!battleId || !generalId) {
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
        return { success: false, message: 'Planning 단계가 아닙니다' };
      }

      // 전체 장수 목록
      const allGeneralIds = [
        ...battle.attackerUnits.map(u => u.generalId),
        ...battle.defenderUnits.map(u => u.generalId)
      ];

      // 해당 장수가 전투에 참가하는지 확인
      if (!allGeneralIds.includes(generalId)) {
        return { success: false, message: '해당 장수는 이 전투에 참가하지 않습니다' };
      }

      // Ready 플레이어에 추가 (중복 방지)
      if (!battle.readyPlayers.includes(generalId)) {
        battle.readyPlayers.push(generalId);
      }

      const allReady = allGeneralIds.every(id => battle.readyPlayers.includes(id));

      await battle.save();

      // 모든 플레이어가 Ready하면 자동으로 Resolution 실행
      if (allReady) {
        // 비동기로 Resolution 실행 (응답은 즉시 반환)
        setImmediate(async () => {
          try {
            await ResolveTurnService.execute(battleId);
          } catch (error) {
            console.error('Auto-resolve failed:', error);
          }
        });

        return {
          success: true,
          message: 'Ready-Up 완료. 턴 해결이 시작됩니다.',
          allReady: true,
          readyPlayers: battle.readyPlayers,
          autoResolving: true
        };
      }

      return {
        success: true,
        message: 'Ready-Up 완료',
        allReady: false,
        readyPlayers: battle.readyPlayers,
        waitingFor: allGeneralIds.filter(id => !battle.readyPlayers.includes(id))
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

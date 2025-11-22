import { battleRepository, battleMapTemplateRepository } from '../../repositories/battle.repository';

export class GetBattleStateService {
  static async execute(data: any, user?: any) {
    const { battleId } = data;

    try {
      if (!battleId) {
        return { success: false, message: '전투 ID가 필요합니다.' };
      }

      const battle = await battleRepository.findByBattleId(battleId);

      if (!battle) {
        return { success: false, message: '전투를 찾을 수 없습니다' };
      }

      // 배치맵 템플릿 조회 (도시별 지형 정보)
      let mapTemplate = null;
      let terrainGrid: string[][] = [];
      
      try {
        mapTemplate = await battleMapTemplateRepository.findBySessionAndCity(
          battle.session_id,
          battle.targetCityId
        );

        if (mapTemplate && mapTemplate.terrain) {
          // 40x40 그리드 초기화
          terrainGrid = Array(40).fill(null).map(() => Array(40).fill('plain'));
          
          // 템플릿의 지형 정보를 그리드에 배치
          mapTemplate.terrain.forEach(tile => {
            if (tile.x >= 0 && tile.x < 40 && tile.y >= 0 && tile.y < 40) {
              terrainGrid[tile.y][tile.x] = tile.type;
            }
          });
        }
      } catch (err) {
        // 템플릿이 없으면 기본 지형 사용
        terrainGrid = Array(40).fill(null).map(() => Array(40).fill(battle.terrain || 'plain'));
      }

      // 유닛에 nation 정보 추가
      const attackerUnits = (battle.attackerUnits || []).map((unit: any) => ({
        ...unit.toObject ? unit.toObject() : unit,
        nation: battle.attackerNationId,
        position: unit.position || null
      }));

      const defenderUnits = (battle.defenderUnits || []).map((unit: any) => ({
        ...unit.toObject ? unit.toObject() : unit,
        nation: battle.defenderNationId,
        position: unit.position || null
      }));

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
          terrain: terrainGrid, // 40x40 지형 그리드
          baseTerrain: battle.terrain, // 기본 지형 (fallback)
          attackerUnits: attackerUnits,
          defenderUnits: defenderUnits,
          readyPlayers: battle.readyPlayers || [],
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

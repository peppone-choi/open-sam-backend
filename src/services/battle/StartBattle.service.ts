import { BattleStatus, BattlePhase, IBattleUnit } from '../../models/battle.model';
import { UnitType, TerrainType } from '../../core/battle-calculator';
import { randomUUID } from 'crypto';
import { battleRepository } from '../../repositories/battle.repository';
import { generalRepository } from '../../repositories/general.repository';
import { cityRepository } from '../../repositories/city.repository';

export class StartBattleService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const attackerNationId = data.attackerNationId;
    const defenderNationId = data.defenderNationId;
    const targetCityId = data.targetCityId;
    const attackerGeneralIds = data.attackerGeneralIds || [];

    try {
      const city = await cityRepository.findByCityNum(sessionId, targetCityId);

      if (!city) {
        return { success: false, message: '대상 도시를 찾을 수 없습니다' };
      }

      const terrain = this.getTerrainFromCity(city);

      const attackerUnits: IBattleUnit[] = [];
      for (const generalId of attackerGeneralIds) {
        const general = await generalRepository.findBySessionAndNo(sessionId, generalId);

        if (!general) continue;

        attackerUnits.push({
          generalId: general.no,
          generalName: general.name || '무명',
          troops: general.crew || 0,
          leadership: general.leadership || 50,
          strength: general.strength || 50,
          intelligence: general.intel || 50,
          unitType: this.getUnitType(general.crewtype),
          morale: general.morale || 80,
          training: general.train || 80,
          techLevel: 50,
          specialSkills: general.specialSkills || []
        });
      }

      const defenderGenerals = await generalRepository.findByFilter({
        session_id: sessionId,
        nation: defenderNationId,
        city: targetCityId,
        crew: { $gt: 0 }
      });

      const defenderUnits: IBattleUnit[] = defenderGenerals.map(general => ({
        generalId: general.no,
        generalName: general.name || '무명',
        troops: general.crew || 0,
        leadership: general.leadership || 50,
        strength: general.strength || 50,
        intelligence: general.intel || 50,
        unitType: this.getUnitType(general.crewtype),
        morale: general.morale || 80,
        training: general.train || 80,
        techLevel: 50,
        specialSkills: general.specialSkills || []
      }));

      const battleId = `battle_${randomUUID()}`;

      const battle = await battleRepository.create({
        session_id: sessionId,
        battleId,
        attackerNationId,
        defenderNationId,
        targetCityId,
        terrain,
        attackerUnits,
        defenderUnits,
        status: BattleStatus.DEPLOYING,
        currentPhase: BattlePhase.PLANNING,
        currentTurn: 0,
        maxTurns: 15,
        planningTimeLimit: 90,
        resolutionTimeLimit: 10,
        currentTurnActions: [],
        readyPlayers: [],
        turnHistory: [],
        startedAt: new Date()
      });

      return {
        success: true,
        battleId: battle.battleId,
        battle: {
          battleId: battle.battleId,
          status: battle.status,
          attackerUnits: battle.attackerUnits,
          defenderUnits: battle.defenderUnits,
          terrain: battle.terrain
        }
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  private static getTerrainFromCity(city: any): TerrainType {
    const terrain = city.terrain;
    if (terrain === 'forest') return TerrainType.FOREST;
    if (terrain === 'mountain') return TerrainType.MOUNTAIN;
    if (terrain === 'water') return TerrainType.WATER;
    if (city.wall > 0) return TerrainType.FORTRESS;
    return TerrainType.PLAINS;
  }

  private static getUnitType(crewtype: number): UnitType {
    switch (crewtype) {
      case 0: return UnitType.FOOTMAN;
      case 1: return UnitType.ARCHER;
      case 2: return UnitType.CAVALRY;
      case 3: return UnitType.WIZARD;
      case 4: return UnitType.SIEGE;
      default: return UnitType.FOOTMAN;
    }
  }
}

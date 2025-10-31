import { Battle, BattleStatus, BattlePhase, IBattleUnit } from '../../models/battle.model';
import { General } from '../../models/general.model';
import { City } from '../../models/city.model';
import { UnitType, TerrainType } from '../../core/battle-calculator';
import { randomUUID } from 'crypto';

export class StartBattleService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const attackerNationId = data.attackerNationId;
    const defenderNationId = data.defenderNationId;
    const targetCityId = data.targetCityId;
    const attackerGeneralIds = data.attackerGeneralIds || [];

    try {
      const city = await City.findOne({
        session_id: sessionId,
        'data.city': targetCityId
      });

      if (!city) {
        return { success: false, message: '대상 도시를 찾을 수 없습니다' };
      }

      const terrain = this.getTerrainFromCity(city.data);

      const attackerUnits: IBattleUnit[] = [];
      for (const generalId of attackerGeneralIds) {
        const general = await General.findOne({
          session_id: sessionId,
          'data.no': generalId
        });

        if (!general) continue;

        attackerUnits.push({
          generalId: general.data.no,
          generalName: general.data.name || '무명',
          troops: general.data.crew || 0,
          leadership: general.data.leadership || 50,
          strength: general.data.strength || 50,
          intelligence: general.data.intel || 50,
          unitType: this.getUnitType(general.data.crewtype),
          morale: general.data.morale || 80,
          training: general.data.train || 80,
          techLevel: 50,
          specialSkills: general.data.specialSkills || []
        });
      }

      const defenderGenerals = await General.find({
        session_id: sessionId,
        'data.nation': defenderNationId,
        'data.city': targetCityId,
        'data.crew': { $gt: 0 }
      }).limit(10);

      const defenderUnits: IBattleUnit[] = defenderGenerals.map(general => ({
        generalId: general.data.no,
        generalName: general.data.name || '무명',
        troops: general.data.crew || 0,
        leadership: general.data.leadership || 50,
        strength: general.data.strength || 50,
        intelligence: general.data.intel || 50,
        unitType: this.getUnitType(general.data.crewtype),
        morale: general.data.morale || 80,
        training: general.data.train || 80,
        techLevel: 50,
        specialSkills: general.data.specialSkills || []
      }));

      const battleId = `battle_${randomUUID()}`;

      const battle = await Battle.create({
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

  private static getTerrainFromCity(cityData: any): TerrainType {
    const terrain = cityData.terrain;
    if (terrain === 'forest') return TerrainType.FOREST;
    if (terrain === 'mountain') return TerrainType.MOUNTAIN;
    if (terrain === 'water') return TerrainType.WATER;
    if (cityData.wall > 0) return TerrainType.FORTRESS;
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

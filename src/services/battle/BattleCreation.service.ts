import { BattleInstance, Direction } from '../../models/battle-instance.model';
import { BattleMapTemplate } from '../../models/battle-map-template.model';
import { General } from '../../models/general.model';
import { City } from '../../models/city.model';
import { Nation } from '../../models/nation.model';
import { nanoid } from 'nanoid';

export interface CreateBattleParams {
  sessionId: string;
  attackerNationId: number;
  defenderNationId: number;
  cityId: number;
  attackerGenerals: number[];
  defenderGenerals: number[];
  entryDirection: Direction;
}

export class BattleCreationService {
  static async createBattle(params: CreateBattleParams) {
    const {
      sessionId,
      attackerNationId,
      defenderNationId,
      cityId,
      attackerGenerals,
      defenderGenerals,
      entryDirection
    } = params;

    const city = await City.findOne({ session_id: sessionId, city: cityId });
    if (!city) {
      throw new Error(`도시를 찾을 수 없습니다: ${cityId}`);
    }

    const attackerNation = await Nation.findOne({ 
      session_id: sessionId, 
      'data.nation': attackerNationId 
    });
    const defenderNation = await Nation.findOne({ 
      session_id: sessionId, 
      'data.nation': defenderNationId 
    });

    if (!attackerNation || !defenderNation) {
      throw new Error('국가 정보를 찾을 수 없습니다');
    }

    const battleId = `battle_${nanoid(12)}`;

    let mapTemplate = await BattleMapTemplate.findOne({ 
      session_id: sessionId, 
      city_id: cityId 
    });

    if (!mapTemplate) {
      mapTemplate = await this.createDefaultMapTemplate(sessionId, cityId, city.name);
    }

    const battleInstance = new BattleInstance({
      session_id: sessionId,
      battle_id: battleId,
      map_template_id: mapTemplate._id,
      city_id: cityId,
      city_name: city.name,
      
      attacker: {
        nation_id: attackerNationId,
        nation_name: attackerNation.data.name || `국가${attackerNationId}`,
        generals: attackerGenerals,
        entry_direction: entryDirection,
        entry_exit_id: `exit_${entryDirection}`
      },
      
      defender: {
        nation_id: defenderNationId,
        nation_name: defenderNation.data.name || `국가${defenderNationId}`,
        generals: defenderGenerals,
        city_defense: true
      },
      
      current_turn: 0,
      phase: 'preparing',
      status: 'preparing',
      
      turn_seconds: 90,
      resolution_seconds: 10,
      turn_limit: 15,
      time_cap_seconds: 1500,
      
      turn_history: [],
      afk_tracking: [],
      
      started_at: new Date()
    });

    await battleInstance.save();

    await this.setGeneralsInBattle(sessionId, [...attackerGenerals, ...defenderGenerals], battleId);

    return {
      success: true,
      battleId,
      battle: battleInstance
    };
  }

  private static async createDefaultMapTemplate(sessionId: string, cityId: number, cityName: string) {
    const exits: any[] = [
      { direction: 'north', position: { x: 20, y: 0 }, connectedCity: 0 },
      { direction: 'east', position: { x: 39, y: 20 }, connectedCity: 0 },
      { direction: 'south', position: { x: 20, y: 39 }, connectedCity: 0 },
      { direction: 'west', position: { x: 0, y: 20 }, connectedCity: 0 }
    ];

    const mapTemplate = new BattleMapTemplate({
      session_id: sessionId,
      city_id: cityId,
      name: `${cityName} 전투맵`,
      width: 40,
      height: 40,
      
      terrain: [],
      
      castle: {
        centerX: 20,
        centerY: 20,
        walls: [
          { x: 18, y: 18 }, { x: 19, y: 18 }, { x: 20, y: 18 }, { x: 21, y: 18 }, { x: 22, y: 18 },
          { x: 18, y: 22 }, { x: 19, y: 22 }, { x: 20, y: 22 }, { x: 21, y: 22 }, { x: 22, y: 22 },
          { x: 18, y: 19 }, { x: 18, y: 20 }, { x: 18, y: 21 },
          { x: 22, y: 19 }, { x: 22, y: 20 }, { x: 22, y: 21 }
        ],
        gates: [
          { x: 20, y: 18 },
          { x: 20, y: 22 }
        ],
        throne: { x: 20, y: 20 }
      },
      
      exits,
      
      deployment: {
        attacker: [],
        defender: [
          { x: 19, y: 19 }, { x: 20, y: 19 }, { x: 21, y: 19 },
          { x: 19, y: 20 }, { x: 21, y: 20 },
          { x: 19, y: 21 }, { x: 20, y: 21 }, { x: 21, y: 21 }
        ]
      },
      
      strategicPoints: []
    });

    await mapTemplate.save();
    return mapTemplate;
  }

  private static async setGeneralsInBattle(sessionId: string, generalIds: number[], battleId: string) {
    for (const generalId of generalIds) {
      await General.updateOne(
        { session_id: sessionId, no: generalId },
        { 
          $set: { 
            'data.battle_status': 'in_battle',
            'data.battle_id': battleId
          } 
        }
      );
    }
  }

  static async getAvailableEntryDirections(sessionId: string, cityId: number): Promise<Direction[]> {
    const mapTemplate = await BattleMapTemplate.findOne({ 
      session_id: sessionId, 
      city_id: cityId 
    });

    if (!mapTemplate) {
      return ['north', 'east', 'south', 'west'];
    }

    return mapTemplate.exits.map(exit => exit.direction);
  }

  static async calculateParticipatingForces(sessionId: string, cityId: number, nationId: number) {
    const generals = await General.find({
      session_id: sessionId,
      'data.nation': nationId,
      'data.city': cityId,
      'data.crew': { $gt: 0 }
    }).select('no name data.crew data.crewtype data.leadership data.strength data.intel').lean();

    const totalCrew = generals.reduce((sum, gen) => sum + (gen.data?.crew || 0), 0);

    return {
      generals: generals.map(g => ({
        generalId: g.no,
        name: g.name,
        crew: g.data?.crew || 0,
        crewType: g.data?.crewtype || 0,
        leadership: g.data?.leadership || 0,
        strength: g.data?.strength || 0,
        intel: g.data?.intel || 0
      })),
      totalCrew,
      generalCount: generals.length
    };
  }
}

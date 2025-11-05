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

    const city = await (City as any).findOne({ session_id: sessionId, city: cityId });
    if (!city) {
      throw new Error(`도시를 찾을 수 없습니다: ${cityId}`);
    }

    const attackerNation = await (Nation as any).findOne({ 
      session_id: sessionId, 
      'data.nation': attackerNationId 
    });
    const defenderNation = await (Nation as any).findOne({ 
      session_id: sessionId, 
      'data.nation': defenderNationId 
    });

    if (!attackerNation || !defenderNation) {
      throw new Error('국가 정보를 찾을 수 없습니다');
    }

    const battleId = `battle_${nanoid(12)}`;

    let mapTemplate = await (BattleMapTemplate as any).findOne({ 
      session_id: sessionId, 
      city_id: cityId 
    });

    if (!mapTemplate) {
      const cityLevel = city.level || city.data?.level || 5;
      const terrainType = city.terrain || city.data?.terrain || 'plain';
      mapTemplate = await this.createDefaultMapTemplate(
        sessionId, 
        cityId, 
        city.name || city.data?.name || `도시 ${cityId}`,
        cityLevel,
        terrainType
      );
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

  private static async createDefaultMapTemplate(sessionId: string, cityId: number, cityName: string, cityLevel?: number, terrainType?: string) {
    const width = 40;
    const height = 40;
    const centerX = 20;
    const centerY = 20;
    
    // 도시 레벨에 따른 성벽 반경 조정 (레벨 높을수록 큰 성)
    const wallRadius = cityLevel ? Math.min(9, 6 + Math.floor(cityLevel / 2)) : 7;
    const innerRadius = wallRadius - 1;
    
    const terrain: any[] = [];
    const walls: any[] = [];
    const gates: any[] = [];
    
    // 40x40 그리드 생성
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const distFromCenter = Math.sqrt(
          Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
        );
        
        let type: string = 'plain';
        let elevation = 0;
        let heightValue = 0;
        
        // 성벽 및 문 생성
        if (distFromCenter <= wallRadius && distFromCenter >= wallRadius - 0.5) {
          const isGate = this.isGatePosition(x, y, centerX, centerY, wallRadius);
          type = isGate ? 'gate' : 'wall';
          heightValue = isGate ? 0 : 3;
          
          if (isGate) {
            gates.push({ x, y });
          } else {
            walls.push({ x, y });
          }
        } else if (distFromCenter < innerRadius) {
          type = 'road';
        } else {
          // 외곽 지형 생성
          if (terrainType === 'mountain' || terrainType === '산') {
            const roll = Math.random();
            if (roll < 0.25) {
              type = 'mountain';
              elevation = Math.floor(Math.random() * 3) + 2;
              heightValue = elevation;
            } else if (roll < 0.5) {
              type = 'hill';
              elevation = Math.floor(Math.random() * 2) + 1;
              heightValue = elevation;
            } else if (roll < 0.7) {
              type = 'forest';
            }
            
            // 가장자리는 산으로
            if (x <= 2 || x >= width - 3 || y <= 2 || y >= height - 3) {
              type = 'mountain';
              elevation = 5;
              heightValue = 5;
            }
          } else if (terrainType === 'water' || terrainType === '강' || terrainType === '수') {
            const roll = Math.random();
            if (roll < 0.15 && (x <= 8 || y >= height - 8)) {
              type = 'water';
              elevation = -1;
              heightValue = -1;
            } else if (roll < 0.2) {
              type = 'forest';
            }
          } else {
            // 평지 기본 지형
            const roll = Math.random();
            if (roll < 0.1) {
              type = 'forest';
            } else if (roll < 0.15) {
              type = 'hill';
              elevation = 1;
              heightValue = 1;
            }
          }
        }
        
        terrain.push({ x, y, type, elevation, height: heightValue });
      }
    }
    
    // 성벽 위치 보완 (더 정확한 원형 성벽)
    for (let angle = 0; angle < 360; angle += 3) {
      const rad = (angle * Math.PI) / 180;
      const x = Math.round(centerX + (wallRadius - 0.5) * Math.cos(rad));
      const y = Math.round(centerY + (wallRadius - 0.5) * Math.sin(rad));
      
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const isGate = this.isGatePosition(x, y, centerX, centerY, wallRadius);
      
      if (isGate && !gates.some(g => g.x === x && g.y === y)) {
        gates.push({ x, y });
      } else if (!isGate && !walls.some(w => w.x === x && w.y === y)) {
        walls.push({ x, y });
        // terrain 배열도 업데이트
        const tileIndex = terrain.findIndex(t => t.x === x && t.y === y);
        if (tileIndex >= 0) {
          terrain[tileIndex].type = 'wall';
          terrain[tileIndex].height = 3;
        }
      }
    }
    
    // 출구 생성 (8방향)
    const exits: any[] = [
      { direction: 'north', position: { x: centerX, y: 0 }, connectedCity: 0 },
      { direction: 'northeast', position: { x: width - 1, y: 0 }, connectedCity: 0 },
      { direction: 'east', position: { x: width - 1, y: centerY }, connectedCity: 0 },
      { direction: 'southeast', position: { x: width - 1, y: height - 1 }, connectedCity: 0 },
      { direction: 'south', position: { x: centerX, y: height - 1 }, connectedCity: 0 },
      { direction: 'southwest', position: { x: 0, y: height - 1 }, connectedCity: 0 },
      { direction: 'west', position: { x: 0, y: centerY }, connectedCity: 0 },
      { direction: 'northwest', position: { x: 0, y: 0 }, connectedCity: 0 }
    ];
    
    // 배치 지역 생성
    const deploymentZoneSize = Math.max(5, Math.floor(wallRadius / 2));
    const attackerDeployment = this.generateDeploymentZone(centerX, Math.max(0, centerY - wallRadius - 3), deploymentZoneSize * 2, deploymentZoneSize);
    const defenderDeployment = this.generateDeploymentZone(centerX, centerY, deploymentZoneSize, deploymentZoneSize);
    
    // 전략적 요점 생성
    const strategicPoints = [
      { name: '북문 광장', position: { x: centerX, y: centerY - Math.floor(wallRadius * 1.5) }, bonus: '방어+10%' },
      { name: '동문 광장', position: { x: centerX + Math.floor(wallRadius * 1.5), y: centerY }, bonus: '방어+10%' },
      { name: '남문 광장', position: { x: centerX, y: centerY + Math.floor(wallRadius * 1.5) }, bonus: '방어+10%' },
      { name: '서문 광장', position: { x: centerX - Math.floor(wallRadius * 1.5), y: centerY }, bonus: '방어+10%' }
    ];
    
    const mapTemplate = new BattleMapTemplate({
      session_id: sessionId,
      city_id: cityId,
      name: `${cityName} 전투맵`,
      width,
      height,
      terrain,
      castle: {
        centerX,
        centerY,
        walls,
        gates,
        throne: { x: centerX, y: centerY }
      },
      exits,
      deployment: {
        attacker: attackerDeployment,
        defender: defenderDeployment
      },
      strategicPoints
    });

    await mapTemplate.save();
    return mapTemplate;
  }
  
  private static isGatePosition(x: number, y: number, centerX: number, centerY: number, radius: number): boolean {
    // 4방향 문 (북, 동, 남, 서)
    const tolerance = 1;
    
    if (Math.abs(x - centerX) <= tolerance && Math.abs(y - (centerY - radius)) <= tolerance) return true; // 북문
    if (Math.abs(x - (centerX + radius)) <= tolerance && Math.abs(y - centerY) <= tolerance) return true; // 동문
    if (Math.abs(x - centerX) <= tolerance && Math.abs(y - (centerY + radius)) <= tolerance) return true; // 남문
    if (Math.abs(x - (centerX - radius)) <= tolerance && Math.abs(y - centerY) <= tolerance) return true; // 서문
    
    return false;
  }
  
  private static generateDeploymentZone(
    centerX: number,
    centerY: number,
    width: number,
    height: number
  ): any[] {
    const positions: any[] = [];
    
    for (let dy = -Math.floor(height / 2); dy <= Math.floor(height / 2); dy++) {
      for (let dx = -Math.floor(width / 2); dx <= Math.floor(width / 2); dx++) {
        const x = Math.max(0, Math.min(39, centerX + dx));
        const y = Math.max(0, Math.min(39, centerY + dy));
        positions.push({ x, y });
      }
    }
    
    return positions;
  }

  private static async setGeneralsInBattle(sessionId: string, generalIds: number[], battleId: string) {
    for (const generalId of generalIds) {
      await (General as any).updateOne(
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
    const mapTemplate = await (BattleMapTemplate as any).findOne({ 
      session_id: sessionId, 
      city_id: cityId 
    });

    if (!mapTemplate) {
      return ['north', 'east', 'south', 'west'];
    }

    return mapTemplate.exits.map(exit => exit.direction);
  }

  static async calculateParticipatingForces(sessionId: string, cityId: number, nationId: number) {
    const generals = await (General as any).find({
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

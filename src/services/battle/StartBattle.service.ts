import { BattleStatus, BattlePhase, IBattleUnit } from '../../models/battle.model';
import { UnitType, TerrainType } from '../../core/battle-calculator';
import { Formation } from './FormationSystem';
import { randomUUID } from 'crypto';
import { battleRepository } from '../../repositories/battle.repository';
import { generalRepository } from '../../repositories/general.repository';
import { cityRepository } from '../../repositories/city.repository';
import { cityDefenseRepository } from '../../repositories/city-defense.repository';
import { unitStackRepository } from '../../repositories/unit-stack.repository';

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

      const cityName = (city as any)?.name ?? `도시${targetCityId}`;

      const defenseState = await cityDefenseRepository.ensure(
        sessionId,
        targetCityId,
        cityName
      );

      const terrain = this.getTerrainFromCity(city);


      const attackerUnits: IBattleUnit[] = [];
      for (const generalId of attackerGeneralIds) {
        const general = await generalRepository.findBySessionAndNo(sessionId, generalId);

        if (!general) continue;

        const unitType = this.getUnitType(general.crewtype);
        const unitProps = this.getUnitProperties(unitType, general.crew || 0);

        attackerUnits.push({
          generalId: general.no,
          generalName: general.name || '무명',
          troops: general.crew || 0,
          maxTroops: general.crew || 0,
          leadership: general.leadership || 50,
          strength: general.strength || 50,
          intelligence: general.intel || 50,
          unitType,
          morale: general.morale || 80,
          training: general.train || 80,
          techLevel: 50,
          nationId: attackerNationId,
          commanderId: general.no,
          originType: 'general',
          
          // 좌표 (배치 단계에서 설정)
          position: { x: 0, y: 0 },
          velocity: { x: 0, y: 0 },
          facing: 0,
          
          // 물리 속성
          collisionRadius: unitProps.collisionRadius,
          moveSpeed: unitProps.moveSpeed,
          attackRange: unitProps.attackRange,
          attackCooldown: unitProps.attackCooldown,
          lastAttackTime: 0,
          
          // 전술
          formation: unitProps.formation,
          stance: 'aggressive' as const,
          
          isCharging: false,
          isAIControlled: false,
          
          specialSkills: general.specialSkills || []
        });
      }

      const defenderGenerals = await generalRepository.findByFilter({
        session_id: sessionId,
        nation: defenderNationId,
        city: targetCityId,
        crew: { $gt: 0 }
      });

      const defenderUnits: IBattleUnit[] = defenderGenerals.map(general => {
        const unitType = this.getUnitType(general.crewtype);
        const unitProps = this.getUnitProperties(unitType, general.crew || 0);
        
        return {
          generalId: general.no,
          generalName: general.name || '무명',
          troops: general.crew || 0,
          maxTroops: general.crew || 0,
          leadership: general.leadership || 50,
          strength: general.strength || 50,
          intelligence: general.intel || 50,
          unitType,
          morale: general.morale || 80,
          training: general.train || 80,
          techLevel: 50,
          nationId: defenderNationId,
          commanderId: general.no,
          originType: 'general' as const,
          
          // 좌표
          position: { x: 0, y: 0 },
          velocity: { x: 0, y: 0 },
          facing: 0,
          
          // 물리 속성
          collisionRadius: unitProps.collisionRadius,
          moveSpeed: unitProps.moveSpeed,
          attackRange: unitProps.attackRange,
          attackCooldown: unitProps.attackCooldown,
          lastAttackTime: 0,
          
          // 전술
          formation: unitProps.formation,
          stance: 'defensive' as const,
          
          isCharging: false,
          isAIControlled: false,
          
          specialSkills: general.specialSkills || []
        };
      });

      // 진입 방향 계산 (임시로 north, 실제로는 ProcessWar에서 전달)
      const entryDirection = 'north';
      
      // 맵 정보 생성
      const mapInfo = this.createMapInfo(terrain, entryDirection, city, defenseState);
      
      const garrisonStacks = await unitStackRepository.findByOwner(sessionId, 'city', targetCityId);
      const garrisonUnits = this.buildCityGarrisonUnits(city, defenseState, garrisonStacks, defenderNationId, mapInfo);
      if (garrisonUnits.length) {
        defenderUnits.push(...garrisonUnits);
      }
      
      // 성 공방전인 경우 성문 유닛 추가
      if (mapInfo.castle && mapInfo.castle.gates.length > 0) {
        const targetGate = mapInfo.castle.gates.find(g => g.id === mapInfo.castle!.targetGateId);
        if (targetGate) {
          defenderUnits.push({
            generalId: -1, // 성문은 특수 ID
            generalName: `${(city as any).name} ${targetGate.id}문`,
            troops: targetGate.hp,
            maxTroops: targetGate.maxHp,
            leadership: 50,
            strength: 50,
            intelligence: 50,
            unitType: UnitType.SIEGE, // 성문은 SIEGE 타입 (CrewType 100과 매핑)
            morale: 100,
            training: 100,
            techLevel: 50,
            
            // 성문 위치
            position: targetGate.position,
            velocity: { x: 0, y: 0 },
            facing: 0,
            
            // 성문 속성
            collisionRadius: 40,
            moveSpeed: 0,  // 이동 불가
            attackRange: 0,
            attackCooldown: 5000,
            lastAttackTime: 0,
            
            formation: Formation.LINE,
            stance: 'hold' as const,
            
            isCharging: false,
            isAIControlled: false,
            
            specialSkills: ['철벽']
          });
        }
      }

      const battleId = `battle_${randomUUID()}`;

      const initialAttackerTroops = attackerUnits.reduce((sum, unit) => sum + (unit.maxTroops ?? unit.troops ?? 0), 0);
      const initialDefenderTroops = defenderUnits.reduce((sum, unit) => sum + (unit.maxTroops ?? unit.troops ?? 0), 0);
      const garrisonSnapshot = garrisonUnits
        .filter(unit => unit.originStackId)
        .map(unit => ({
          stackId: unit.originStackId!,
          initialTroops: unit.maxTroops ?? unit.troops ?? 0,
        }));
      
      const battle = await battleRepository.create({
        session_id: sessionId,
        battleId,
        attackerNationId,
        defenderNationId,
        targetCityId,
        terrain,
        attackerUnits: attackerUnits as any,
        defenderUnits: defenderUnits as any,
        status: BattleStatus.DEPLOYING,
        currentPhase: BattlePhase.PLANNING,
        currentTurn: 0,
        maxTurns: 15,
        planningTimeLimit: 90,
        resolutionTimeLimit: 10,
        currentTurnActions: [],
        readyPlayers: [],
        turnHistory: [],
        map: mapInfo as any,
        isRealtime: true,
        tickRate: 20,
        startedAt: new Date(),
        meta: {
          initialAttackerTroops,
          initialDefenderTroops,
          garrisonStacks: garrisonSnapshot,
          cityName,
        }
      } as any);


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
  
  private static createMapInfo(terrain: TerrainType, entryDirection: string, city: any, defenseState?: any) {
    const mapInfo: any = {
      width: 800,
      height: 600,
      entryDirection,
      attackerZone: this.getAttackerZone(entryDirection),
      defenderZone: this.getDefenderZone(entryDirection, terrain === TerrainType.FORTRESS)
    };
    
    // 성 공방전
    if (terrain === TerrainType.FORTRESS && (city as any).wall > 0) {
      const wallHp = defenseState?.wall_hp ?? (city as any).wall ?? 50;
      const gateHp = defenseState?.gate_hp ?? wallHp * 2;
      const gateMax = defenseState?.gate_max ?? gateHp;
      
      mapInfo.castle = {
        center: { x: 400, y: 300 },
        radius: 120,
        gates: [
          { id: 'north', position: { x: 400, y: 180 }, width: 40, height: 15, hp: gateHp, maxHp: gateMax },
          { id: 'south', position: { x: 400, y: 420 }, width: 40, height: 15, hp: gateHp, maxHp: gateMax },
          { id: 'east', position: { x: 520, y: 300 }, width: 15, height: 40, hp: gateHp, maxHp: gateMax },
          { id: 'west', position: { x: 280, y: 300 }, width: 15, height: 40, hp: gateHp, maxHp: gateMax }
        ],
        targetGateId: this.getTargetGate(entryDirection)
      };
    }
    
    return mapInfo;
  }
  
  private static getAttackerZone(direction: string) {
    const zones: Record<string, { x: [number, number]; y: [number, number] }> = {
      north: { x: [200, 600], y: [0, 100] },
      south: { x: [200, 600], y: [500, 600] },
      east: { x: [700, 800], y: [200, 400] },
      west: { x: [0, 100], y: [200, 400] },
      northeast: { x: [600, 800], y: [0, 150] },
      southeast: { x: [600, 800], y: [450, 600] },
      northwest: { x: [0, 200], y: [0, 150] },
      southwest: { x: [0, 200], y: [450, 600] }
    };
    return zones[direction] || zones.north;
  }
  
  private static getDefenderZone(direction: string, isCastle: boolean) {
    if (isCastle) {
      // 성 내부
      return { x: [320, 480], y: [220, 380] };
    }
    
    // 야전: 반대편
    const oppositeZones: Record<string, { x: [number, number]; y: [number, number] }> = {
      north: { x: [200, 600], y: [500, 600] },
      south: { x: [200, 600], y: [0, 100] },
      east: { x: [0, 100], y: [200, 400] },
      west: { x: [700, 800], y: [200, 400] },
      northeast: { x: [0, 200], y: [450, 600] },
      southeast: { x: [0, 200], y: [0, 150] },
      northwest: { x: [600, 800], y: [450, 600] },
      southwest: { x: [600, 800], y: [0, 150] }
    };
    return oppositeZones[direction] || oppositeZones.south;
  }
  
  private static getTargetGate(direction: string): string {
    const gateMapping: Record<string, string> = {
      north: 'north',
      south: 'south',
      east: 'east',
      west: 'west',
      northeast: 'north',
      southeast: 'south',
      northwest: 'north',
      southwest: 'south'
    };
    return gateMapping[direction] || 'north';
  }

  private static buildCityGarrisonUnits(
    city: any,
    defenseState: any,
    stacks: any[],
    defenderNationId: number,
    mapInfo: any
  ): IBattleUnit[] {
    if (!stacks || stacks.length === 0) {
      return [];
    }
    const stance: 'hold' | 'defensive' = mapInfo?.castle ? 'hold' : 'defensive';
    return stacks
      .map((stack: any, index: number) => {
        const troops = this.getStackTroopCount(stack);
        if (troops <= 0) {
          return null;
        }
        const unitType = this.getUnitType(stack.crew_type_id ?? stack.unit_type ?? 0);
        const unitProps = this.getUnitProperties(unitType, troops);
        const position = this.getGarrisonPosition(mapInfo);
        return {
          generalId: -1000 - index,
          generalName: `${city?.name || '도시'} 수비대`,
          troops,
          maxTroops: troops,
          leadership: 45,
          strength: 45,
          intelligence: 40,
          unitType,
          morale: stack.morale ?? 75,
          training: stack.train ?? 70,
          techLevel: 40,
          nationId: defenderNationId,
          commanderId: null,
          originType: 'cityStack' as const,
          originStackId: stack._id?.toString?.() || stack.id,
          position,
          velocity: { x: 0, y: 0 },
          facing: 0,
          collisionRadius: unitProps.collisionRadius,
          moveSpeed: unitProps.moveSpeed,
          attackRange: unitProps.attackRange,
          attackCooldown: unitProps.attackCooldown,
          lastAttackTime: 0,
          formation: unitProps.formation,
          stance,
          isCharging: false,
          isAIControlled: true,
          specialSkills: ['수비태세']
        } as IBattleUnit;
      })
      .filter((unit): unit is IBattleUnit => Boolean(unit));
  }

  private static getStackTroopCount(stack: any): number {
    if (!stack) {
      return 0;
    }
    if (typeof stack.hp === 'number') {
      return Math.max(0, Math.round(stack.hp));
    }
    const unitSize = stack.unit_size ?? 100;
    const stackCount = stack.stack_count ?? 0;
    return Math.max(0, unitSize * stackCount);
  }

  private static getGarrisonPosition(mapInfo: any): { x: number; y: number } {
    if (mapInfo?.castle) {
      const center = mapInfo.castle.center;
      const radius = Math.max(20, mapInfo.castle.radius - 20);
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius;
      return {
        x: center.x + Math.cos(angle) * dist,
        y: center.y + Math.sin(angle) * dist,
      };
    }
    const zone = mapInfo?.defenderZone || { x: [300, 500], y: [300, 500] };
    return {
      x: this.randomInRange(zone.x[0], zone.x[1]),
      y: this.randomInRange(zone.y[0], zone.y[1]),
    };
  }

  private static randomInRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
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
  
  private static getUnitProperties(unitType: UnitType, troops: number) {
    const baseRadius = 15;
    const troopBonus = Math.floor(troops / 200);
    
    const properties = {
      [UnitType.FOOTMAN]: {
        collisionRadius: baseRadius + troopBonus,
        moveSpeed: 50,
        attackRange: 20,
        attackCooldown: 1500,
        formation: Formation.LINE
      },
      [UnitType.CAVALRY]: {
        collisionRadius: baseRadius + troopBonus + 5,
        moveSpeed: 100,
        attackRange: 25,
        attackCooldown: 1200,
        formation: 'wedge' as const
      },
      [UnitType.ARCHER]: {
        collisionRadius: baseRadius + troopBonus - 2,
        moveSpeed: 60,
        attackRange: 150,
        attackCooldown: 2000,
        formation: 'skirmish' as const
      },
      [UnitType.WIZARD]: {
        collisionRadius: baseRadius + troopBonus,
        moveSpeed: 55,
        attackRange: 120,
        attackCooldown: 2500,
        formation: Formation.LINE
      },
      [UnitType.SIEGE]: {
        collisionRadius: baseRadius + troopBonus + 10,
        moveSpeed: 30,
        attackRange: 30,
        attackCooldown: 3000,
        formation: 'column' as const
      }
    };
    
    return properties[unitType] || properties[UnitType.FOOTMAN];
  }
}

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
  /**
   * 전투 시작
   * @param data.multiStackMode - true면 장수 1명당 여러 스택을 개별 유닛으로 분리 (토탈 워 스타일)
   */
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const attackerNationId = data.attackerNationId;
    const defenderNationId = data.defenderNationId;
    const targetCityId = data.targetCityId;
    const attackerGeneralIds = data.attackerGeneralIds || [];
    const multiStackMode = data.multiStackMode ?? true; // 기본값: 멀티 스택 활성화

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

      // 공격자 유닛 생성
      const attackerUnits: IBattleUnit[] = [];
      for (const generalId of attackerGeneralIds) {
        const general = await generalRepository.findBySessionAndNo(sessionId, generalId);
        if (!general) continue;

        if (multiStackMode) {
          // 멀티 스택 모드: 장수의 각 스택을 개별 유닛으로
          const stackUnits = await this.buildGeneralMultiStackUnits(
            sessionId,
            general,
            attackerNationId,
            'aggressive',
            false
          );
          attackerUnits.push(...stackUnits);
        } else {
          // 레거시 모드: 장수 1명 = 유닛 1개
          const { troops, maxTroops, training, morale } = await this.getGeneralUnitStats(sessionId, general);
          if (troops <= 0) continue;

          const unitType = this.getUnitType((general as any).crewtype);
          const unitProps = this.getUnitProperties(unitType, troops || 0);

          attackerUnits.push({
            generalId: general.no,
            generalName: general.name || '무명',
            troops,
            maxTroops,
            leadership: general.leadership || 50,
            strength: general.strength || 50,
            intelligence: general.intel || 50,
            unitType,
            morale,
            training,
            techLevel: 50,
            nationId: attackerNationId,
            commanderId: general.no,
            originType: 'general',
            position: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
            facing: 0,
            collisionRadius: unitProps.collisionRadius,
            moveSpeed: unitProps.moveSpeed,
            attackRange: unitProps.attackRange,
            attackCooldown: unitProps.attackCooldown,
            lastAttackTime: 0,
            formation: unitProps.formation,
            stance: 'aggressive' as const,
            isCharging: false,
            isAIControlled: false,
            specialSkills: (general as any).specialSkills || []
          });
        }
      }

      // 방어자 장수 조회
      const defenderGenerals = await generalRepository.findByFilter({
        session_id: sessionId,
        nation: defenderNationId,
        city: targetCityId,
        crew: { $gt: 0 }
      });
 
      // 방어자 유닛 생성
      const defenderUnits: IBattleUnit[] = [];
      for (const general of defenderGenerals) {
        if (multiStackMode) {
          // 멀티 스택 모드: 장수의 각 스택을 개별 유닛으로
          const stackUnits = await this.buildGeneralMultiStackUnits(
            sessionId,
            general,
            defenderNationId,
            'defensive',
            false
          );
          defenderUnits.push(...stackUnits);
        } else {
          // 레거시 모드
          const { troops, maxTroops, training, morale } = await this.getGeneralUnitStats(sessionId, general);
          if (troops <= 0) continue;

          const unitType = this.getUnitType((general as any).crewtype);
          const unitProps = this.getUnitProperties(unitType, troops || 0);
          
          defenderUnits.push({
            generalId: general.no,
            generalName: general.name || '무명',
            troops,
            maxTroops,
            leadership: general.leadership || 50,
            strength: general.strength || 50,
            intelligence: general.intel || 50,
            unitType,
            morale,
            training,
            techLevel: 50,
            nationId: defenderNationId,
            commanderId: general.no,
            originType: 'general' as const,
            position: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
            facing: 0,
            collisionRadius: unitProps.collisionRadius,
            moveSpeed: unitProps.moveSpeed,
            attackRange: unitProps.attackRange,
            attackCooldown: unitProps.attackCooldown,
            lastAttackTime: 0,
            formation: unitProps.formation,
            stance: 'defensive' as const,
            isCharging: false,
            isAIControlled: false,
            specialSkills: (general as any).specialSkills || []
          });
        }
      }


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
        initialAttackerUnits: JSON.parse(JSON.stringify(attackerUnits)),
        initialDefenderUnits: JSON.parse(JSON.stringify(defenderUnits)),
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

  private static async getGeneralUnitStats(
    sessionId: string,
    general: any,
  ): Promise<{ troops: number; maxTroops: number; training: number; morale: number }> {
    const stacks = await unitStackRepository.findByOwner(sessionId, 'general', general.no);
    let totalTroops = 0;
    let weightedTrain = 0;
    let weightedMorale = 0;

    for (const stack of stacks as any[]) {
      const troops = this.getStackTroopCount(stack);
      if (troops <= 0) continue;
      totalTroops += troops;
      const stackTrain = typeof stack.train === 'number' ? stack.train : 0;
      const stackMorale = typeof stack.morale === 'number' ? stack.morale : 0;
      weightedTrain += stackTrain * troops;
      weightedMorale += stackMorale * troops;
    }

    const rawCrew = (general as any).crew ?? (general as any).data?.crew ?? 0;
    const fallbackCrew = typeof rawCrew === 'number' && Number.isFinite(rawCrew) ? rawCrew : 0;
    const troops = totalTroops > 0 ? totalTroops : Math.max(0, fallbackCrew);

    const baseTrain = (general as any).train ?? (general as any).data?.train ?? 0;
    const baseAtmos = (general as any).atmos ?? (general as any).data?.atmos ?? 50;

    const training = totalTroops > 0
      ? Math.round(weightedTrain / totalTroops)
      : baseTrain;
    const morale = totalTroops > 0
      ? Math.round(weightedMorale / totalTroops)
      : baseAtmos;

    return {
      troops,
      maxTroops: troops,
      training,
      morale,
    };
  }

  /**
   * 멀티 스택 전투: 장수의 각 스택을 개별 전투 유닛으로 변환
   * 토탈 워 스타일 - 장수 1명이 여러 병종 스택을 독립 제어
   */
  private static async buildGeneralMultiStackUnits(
    sessionId: string,
    general: any,
    nationId: number,
    stance: 'aggressive' | 'defensive' = 'aggressive',
    isAIControlled: boolean = false
  ): Promise<IBattleUnit[]> {
    const stacks = await unitStackRepository.findByOwner(sessionId, 'general', general.no);
    const units: IBattleUnit[] = [];
    
    const generalLeadership = general.leadership || 50;
    const generalStrength = general.strength || 50;
    const generalIntel = general.intel || 50;
    
    for (let i = 0; i < stacks.length; i++) {
      const stack = stacks[i] as any;
      const troops = this.getStackTroopCount(stack);
      if (troops <= 0) continue;
      
      const unitType = this.getUnitType(stack.crew_type_id ?? 0);
      const unitProps = this.getUnitProperties(unitType, troops);
      const stackMorale = typeof stack.morale === 'number' ? stack.morale : 70;
      const stackTrain = typeof stack.train === 'number' ? stack.train : 70;
      
      // 스택 타입에 따른 스탯 보정
      const statModifier = this.getStackStatModifier(unitType);
      
      units.push({
        // 유닛 식별: generalId는 스택 인덱스로 구분 (장수no * 100 + 인덱스)
        generalId: general.no * 100 + i,
        generalName: `${general.name || '무명'} ${stack.crew_type_name || this.getUnitTypeName(unitType)}`,
        troops,
        maxTroops: troops,
        
        // 장수 스탯 + 병종 보정
        leadership: Math.round(generalLeadership * statModifier.leadership),
        strength: Math.round(generalStrength * statModifier.strength),
        intelligence: Math.round(generalIntel * statModifier.intelligence),
        
        unitType,
        morale: stackMorale,
        training: stackTrain,
        techLevel: 50,
        nationId,
        
        // 지휘관 연결 (같은 장수의 유닛들을 그룹화)
        commanderId: general.no,
        originType: 'generalStack',
        originStackId: stack._id?.toString?.() || stack.id,
        
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
        
        // 전술 (병종에 맞는 기본 진형)
        formation: unitProps.formation,
        stance,
        
        isCharging: false,
        isAIControlled,
        
        specialSkills: this.getStackSpecialSkills(unitType)
      });
    }
    
    // 스택이 없으면 레거시 crew 값으로 단일 유닛 생성
    if (units.length === 0) {
      const legacyCrew = (general as any).crew ?? (general as any).data?.crew ?? 0;
      if (legacyCrew > 0) {
        const unitType = this.getUnitType((general as any).crewtype ?? 0);
        const unitProps = this.getUnitProperties(unitType, legacyCrew);
        units.push({
          generalId: general.no,
          generalName: general.name || '무명',
          troops: legacyCrew,
          maxTroops: legacyCrew,
          leadership: generalLeadership,
          strength: generalStrength,
          intelligence: generalIntel,
          unitType,
          morale: (general as any).atmos ?? 50,
          training: (general as any).train ?? 50,
          techLevel: 50,
          nationId,
          commanderId: general.no,
          originType: 'general',
          position: { x: 0, y: 0 },
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
          isAIControlled,
          specialSkills: []
        });
      }
    }
    
    return units;
  }
  
  /**
   * 병종별 스탯 보정치
   * 기병: 통솔↑, 보병: 무력↑, 궁병: 지력↑
   */
  private static getStackStatModifier(unitType: UnitType): { leadership: number; strength: number; intelligence: number } {
    switch (unitType) {
      case UnitType.CAVALRY:
        return { leadership: 1.1, strength: 1.0, intelligence: 0.9 };
      case UnitType.FOOTMAN:
        return { leadership: 1.0, strength: 1.1, intelligence: 0.9 };
      case UnitType.ARCHER:
        return { leadership: 0.9, strength: 0.9, intelligence: 1.1 };
      case UnitType.WIZARD:
        return { leadership: 0.9, strength: 0.8, intelligence: 1.2 };
      case UnitType.SIEGE:
        return { leadership: 1.0, strength: 1.2, intelligence: 0.8 };
      default:
        return { leadership: 1.0, strength: 1.0, intelligence: 1.0 };
    }
  }
  
  /**
   * 병종별 특수 스킬
   */
  private static getStackSpecialSkills(unitType: UnitType): string[] {
    switch (unitType) {
      case UnitType.CAVALRY:
        return ['돌격', '추격'];
      case UnitType.FOOTMAN:
        return ['방진', '장창'];
      case UnitType.ARCHER:
        return ['일제사격', '화살비'];
      case UnitType.WIZARD:
        return ['화공', '낙뢰'];
      case UnitType.SIEGE:
        return ['공성', '파성'];
      default:
        return [];
    }
  }
  
  private static getUnitTypeName(unitType: UnitType): string {
    switch (unitType) {
      case UnitType.CAVALRY: return '기병대';
      case UnitType.FOOTMAN: return '보병대';
      case UnitType.ARCHER: return '궁병대';
      case UnitType.WIZARD: return '모사대';
      case UnitType.SIEGE: return '공성대';
      default: return '부대';
    }
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

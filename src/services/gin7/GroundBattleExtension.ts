/**
 * GroundBattleExtension - 지상전 확장 시스템
 * 
 * 행성 타입별 전투 수정자, 참가 가능 유닛 필터링,
 * 지형 효과 (도시/사막/정글), 요새 공방전
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  GroundBattle,
  IGroundBattle,
  IGroundUnit,
  GroundUnitType,
  GROUND_UNIT_SPECS,
} from '../../models/gin7/GroundBattle';
import { Planet, IPlanet, PlanetType } from '../../models/gin7/Planet';
import { Fortress, IFortress } from '../../models/gin7/Fortress';
import { logger } from '../../common/logger';

// ============================================================
// Types & Interfaces
// ============================================================

/**
 * 행성 타입별 전투 수정자
 */
export interface GroundBattleModifier {
  planetType: PlanetType;
  attackModifier: number;       // 공격력 배수 (1.0 = 기본)
  defenseModifier: number;      // 방어력 배수
  moraleModifier: number;       // 사기 변화 배수
  conquestSpeedModifier: number; // 점령 속도 배수
  allowedUnitTypes: GroundUnitType[]; // 허용되는 유닛 타입
  specialEffects: string[];     // 특수 효과 목록
}

/**
 * 지형 효과
 */
export interface TerrainEffect {
  terrainId: string;
  name: string;
  nameKo: string;
  description: string;
  
  // 전투 수정자
  attackBonus: number;          // 공격 보너스 (%)
  defenseBonus: number;         // 방어 보너스 (%)
  coverBonus: number;           // 엄폐 보너스 (피해 감소 %)
  
  // 이동/점령 수정자
  movementPenalty: number;      // 이동 페널티 (0 = 패널티 없음)
  conquestPenalty: number;      // 점령 속도 페널티
  
  // 유닛 타입별 보너스
  unitTypeBonus: Partial<Record<GroundUnitType, number>>;
  
  // 특수 효과
  damageOverTime?: number;      // 턴당 지속 피해
  visibilityReduction?: number; // 시야 감소
}

/**
 * 요새 방어 상태
 */
export interface FortressDefenseState {
  fortressId: string;
  wallIntegrity: number;        // 성벽 내구도 (0-100)
  shieldPower: number;          // 방어막 파워 (0-100)
  garrisonStrength: number;     // 수비대 강도
  turretCount: number;          // 포탑 수
  turretDamage: number;         // 포탑 데미지
  breachedSections: string[];   // 돌파된 구역
  isUnderSiege: boolean;        // 포위 상태
  siegeDuration: number;        // 포위 지속 시간 (틱)
}

/**
 * 요새 공격 결과
 */
export interface FortressAssaultResult {
  success: boolean;
  wallDamage: number;
  shieldDamage: number;
  defenderCasualties: number;
  attackerCasualties: number;
  breached: boolean;
  breachedSection?: string;
}

// ============================================================
// Constants
// ============================================================

/**
 * 행성 타입별 전투 수정자 정의
 */
export const PLANET_BATTLE_MODIFIERS: Record<PlanetType, GroundBattleModifier> = {
  terran: {
    planetType: 'terran',
    attackModifier: 1.0,
    defenseModifier: 1.0,
    moraleModifier: 1.0,
    conquestSpeedModifier: 1.0,
    allowedUnitTypes: ['armored', 'grenadier', 'infantry'],
    specialEffects: [],
  },
  ocean: {
    planetType: 'ocean',
    attackModifier: 0.8,
    defenseModifier: 1.1,
    moraleModifier: 0.9,
    conquestSpeedModifier: 0.7,
    allowedUnitTypes: ['infantry'], // 기갑 불가
    specialEffects: ['amphibious_required', 'supply_penalty'],
  },
  desert: {
    planetType: 'desert',
    attackModifier: 0.9,
    defenseModifier: 0.85,
    moraleModifier: 0.85,
    conquestSpeedModifier: 1.2,
    allowedUnitTypes: ['armored', 'grenadier', 'infantry'],
    specialEffects: ['heat_damage', 'supply_drain'],
  },
  ice: {
    planetType: 'ice',
    attackModifier: 0.85,
    defenseModifier: 1.0,
    moraleModifier: 0.8,
    conquestSpeedModifier: 0.8,
    allowedUnitTypes: ['armored', 'infantry'],
    specialEffects: ['cold_damage', 'movement_penalty'],
  },
  gas_giant: {
    planetType: 'gas_giant',
    attackModifier: 0,
    defenseModifier: 0,
    moraleModifier: 0,
    conquestSpeedModifier: 0,
    allowedUnitTypes: [], // 지상전 불가
    specialEffects: ['no_ground_combat'],
  },
  volcanic: {
    planetType: 'volcanic',
    attackModifier: 0.9,
    defenseModifier: 0.9,
    moraleModifier: 0.7,
    conquestSpeedModifier: 0.9,
    allowedUnitTypes: ['armored', 'grenadier'],
    specialEffects: ['lava_damage', 'visibility_reduction'],
  },
  artificial: {
    planetType: 'artificial',
    attackModifier: 1.1,
    defenseModifier: 1.3,
    moraleModifier: 1.0,
    conquestSpeedModifier: 0.5,
    allowedUnitTypes: ['grenadier', 'infantry'],
    specialEffects: ['corridor_combat', 'fortified_positions'],
  },
  barren: {
    planetType: 'barren',
    attackModifier: 1.0,
    defenseModifier: 0.8,
    moraleModifier: 0.9,
    conquestSpeedModifier: 1.3,
    allowedUnitTypes: ['armored', 'grenadier', 'infantry'],
    specialEffects: ['no_cover', 'vacuum_hazard'],
  },
};

/**
 * 지형 효과 정의
 */
export const TERRAIN_EFFECTS: Record<string, TerrainEffect> = {
  urban: {
    terrainId: 'urban',
    name: 'Urban',
    nameKo: '도시',
    description: '고층 건물과 좁은 골목이 있는 도시 지역',
    attackBonus: -5,
    defenseBonus: 25,
    coverBonus: 30,
    movementPenalty: 10,
    conquestPenalty: 20,
    unitTypeBonus: {
      infantry: 20,
      grenadier: 10,
      armored: -15,
    },
    visibilityReduction: 20,
  },
  desert: {
    terrainId: 'desert',
    name: 'Desert',
    nameKo: '사막',
    description: '끝없이 펼쳐진 모래 사막',
    attackBonus: 0,
    defenseBonus: -10,
    coverBonus: 0,
    movementPenalty: 15,
    conquestPenalty: 0,
    unitTypeBonus: {
      armored: 10,
      infantry: -10,
      grenadier: 0,
    },
    damageOverTime: 2,
  },
  jungle: {
    terrainId: 'jungle',
    name: 'Jungle',
    nameKo: '정글',
    description: '울창한 밀림 지대',
    attackBonus: -10,
    defenseBonus: 20,
    coverBonus: 40,
    movementPenalty: 25,
    conquestPenalty: 30,
    unitTypeBonus: {
      infantry: 25,
      grenadier: 5,
      armored: -30,
    },
    visibilityReduction: 40,
    damageOverTime: 1,
  },
  plains: {
    terrainId: 'plains',
    name: 'Plains',
    nameKo: '평원',
    description: '평탄한 개활지',
    attackBonus: 5,
    defenseBonus: -5,
    coverBonus: 0,
    movementPenalty: 0,
    conquestPenalty: 0,
    unitTypeBonus: {
      armored: 20,
      infantry: 0,
      grenadier: 0,
    },
  },
  mountains: {
    terrainId: 'mountains',
    name: 'Mountains',
    nameKo: '산악',
    description: '험준한 산악 지형',
    attackBonus: -15,
    defenseBonus: 35,
    coverBonus: 25,
    movementPenalty: 35,
    conquestPenalty: 25,
    unitTypeBonus: {
      infantry: 15,
      grenadier: -5,
      armored: -40,
    },
  },
  tundra: {
    terrainId: 'tundra',
    name: 'Tundra',
    nameKo: '동토',
    description: '얼어붙은 황무지',
    attackBonus: -5,
    defenseBonus: 5,
    coverBonus: 5,
    movementPenalty: 20,
    conquestPenalty: 10,
    unitTypeBonus: {
      armored: -10,
      infantry: 5,
      grenadier: 0,
    },
    damageOverTime: 3,
  },
  swamp: {
    terrainId: 'swamp',
    name: 'Swamp',
    nameKo: '늪지',
    description: '질척거리는 늪지대',
    attackBonus: -10,
    defenseBonus: 15,
    coverBonus: 15,
    movementPenalty: 40,
    conquestPenalty: 35,
    unitTypeBonus: {
      infantry: 10,
      grenadier: -10,
      armored: -50,
    },
    damageOverTime: 2,
  },
  fortress_interior: {
    terrainId: 'fortress_interior',
    name: 'Fortress Interior',
    nameKo: '요새 내부',
    description: '요새 내부의 좁은 통로와 방어 시설',
    attackBonus: -20,
    defenseBonus: 40,
    coverBonus: 50,
    movementPenalty: 5,
    conquestPenalty: 50,
    unitTypeBonus: {
      infantry: 30,
      grenadier: 20,
      armored: -60,
    },
    visibilityReduction: 10,
  },
};

/**
 * 요새 공방전 상수
 */
const FORTRESS_COMBAT_CONSTANTS = {
  WALL_BASE_HP: 1000,
  SHIELD_BASE_POWER: 500,
  SIEGE_MORALE_DRAIN: 2,       // 포위 중 방어측 사기 감소/틱
  BREACH_THRESHOLD: 30,        // 성벽 30% 이하면 돌파 가능
  TURRET_BASE_DAMAGE: 50,
  TURRET_COOLDOWN: 3,          // 틱
  SUPPLY_DRAIN_RATE: 5,        // 포위 중 보급 감소/틱
  MAX_SIEGE_DURATION: 100,     // 최대 포위 기간 (틱)
};

// ============================================================
// GroundBattleExtension Class
// ============================================================

export class GroundBattleExtension extends EventEmitter {
  private static instance: GroundBattleExtension;
  
  private constructor() {
    super();
    logger.info('[GroundBattleExtension] Initialized');
  }
  
  public static getInstance(): GroundBattleExtension {
    if (!GroundBattleExtension.instance) {
      GroundBattleExtension.instance = new GroundBattleExtension();
    }
    return GroundBattleExtension.instance;
  }
  
  // ============================================================
  // Planet Type Modifiers
  // ============================================================
  
  /**
   * 행성 타입에 따른 전투 수정자 조회
   */
  getPlanetBattleModifier(planetType: PlanetType): GroundBattleModifier {
    return PLANET_BATTLE_MODIFIERS[planetType] || PLANET_BATTLE_MODIFIERS.terran;
  }
  
  /**
   * 특정 행성에서 지상전 가능 여부
   */
  canConductGroundBattle(planetType: PlanetType): boolean {
    const modifier = this.getPlanetBattleModifier(planetType);
    return !modifier.specialEffects.includes('no_ground_combat');
  }
  
  /**
   * 행성에서 유닛 타입 사용 가능 여부
   */
  isUnitTypeAllowed(planetType: PlanetType, unitType: GroundUnitType): boolean {
    const modifier = this.getPlanetBattleModifier(planetType);
    return modifier.allowedUnitTypes.includes(unitType);
  }
  
  /**
   * 행성 타입별 수정된 유닛 스탯 계산
   */
  getModifiedUnitStats(
    unit: IGroundUnit,
    planetType: PlanetType,
    terrainId?: string
  ): {
    attack: number;
    defense: number;
    morale: number;
    conquestPower: number;
  } {
    const planetMod = this.getPlanetBattleModifier(planetType);
    const terrain = terrainId ? TERRAIN_EFFECTS[terrainId] : null;
    
    let attack = unit.stats.attack * planetMod.attackModifier;
    let defense = unit.stats.defense * planetMod.defenseModifier;
    let morale = unit.stats.morale * planetMod.moraleModifier;
    let conquestPower = unit.stats.conquestPower * planetMod.conquestSpeedModifier;
    
    // 지형 효과 적용
    if (terrain) {
      attack *= (1 + terrain.attackBonus / 100);
      defense *= (1 + terrain.defenseBonus / 100);
      
      // 유닛 타입별 보너스
      const typeBonus = terrain.unitTypeBonus[unit.type] || 0;
      attack *= (1 + typeBonus / 100);
      defense *= (1 + typeBonus / 100);
      
      // 점령력 페널티
      conquestPower *= (1 - terrain.conquestPenalty / 100);
    }
    
    return {
      attack: Math.floor(attack),
      defense: Math.floor(defense),
      morale: Math.floor(morale),
      conquestPower,
    };
  }
  
  /**
   * 참전 가능 유닛 필터링
   */
  filterAllowedUnits(
    units: IGroundUnit[],
    planetType: PlanetType
  ): { allowed: IGroundUnit[]; rejected: IGroundUnit[] } {
    const allowed: IGroundUnit[] = [];
    const rejected: IGroundUnit[] = [];
    
    for (const unit of units) {
      if (this.isUnitTypeAllowed(planetType, unit.type)) {
        allowed.push(unit);
      } else {
        rejected.push(unit);
      }
    }
    
    return { allowed, rejected };
  }
  
  // ============================================================
  // Terrain Effects
  // ============================================================
  
  /**
   * 지형 효과 조회
   */
  getTerrainEffect(terrainId: string): TerrainEffect | undefined {
    return TERRAIN_EFFECTS[terrainId];
  }
  
  /**
   * 모든 지형 효과 목록
   */
  getAllTerrainEffects(): TerrainEffect[] {
    return Object.values(TERRAIN_EFFECTS);
  }
  
  /**
   * 지형에 따른 피해 계산
   */
  calculateTerrainDamage(
    attacker: IGroundUnit,
    defender: IGroundUnit,
    baseDamage: number,
    terrainId: string
  ): { damage: number; blocked: number } {
    const terrain = TERRAIN_EFFECTS[terrainId];
    if (!terrain) {
      return { damage: baseDamage, blocked: 0 };
    }
    
    // 엄폐 보너스에 의한 피해 감소
    const coverReduction = baseDamage * (terrain.coverBonus / 100);
    
    // 방어 보너스
    const defenseBonus = baseDamage * (terrain.defenseBonus / 100);
    
    // 최종 피해
    const finalDamage = Math.max(1, Math.floor(baseDamage - coverReduction - defenseBonus));
    const blocked = baseDamage - finalDamage;
    
    return { damage: finalDamage, blocked };
  }
  
  /**
   * 지형 지속 피해 적용
   */
  applyTerrainDamageOverTime(
    battle: IGroundBattle,
    terrainId: string
  ): { attackerDamage: number; defenderDamage: number } {
    const terrain = TERRAIN_EFFECTS[terrainId];
    if (!terrain || !terrain.damageOverTime) {
      return { attackerDamage: 0, defenderDamage: 0 };
    }
    
    let attackerDamage = 0;
    let defenderDamage = 0;
    
    // 모든 유닛에 지속 피해
    for (const unit of battle.attackerUnits) {
      if (!unit.isDestroyed) {
        const damage = terrain.damageOverTime * unit.count;
        unit.stats.hp -= damage;
        unit.damageTaken += damage;
        attackerDamage += damage;
      }
    }
    
    for (const unit of battle.defenderUnits) {
      if (!unit.isDestroyed) {
        const damage = terrain.damageOverTime * unit.count;
        unit.stats.hp -= damage;
        unit.damageTaken += damage;
        defenderDamage += damage;
      }
    }
    
    return { attackerDamage, defenderDamage };
  }
  
  // ============================================================
  // Fortress Siege Combat
  // ============================================================
  
  /**
   * 요새 방어 상태 초기화
   */
  async initializeFortressDefense(
    sessionId: string,
    fortressId: string
  ): Promise<FortressDefenseState | null> {
    const fortress = await Fortress.findOne({ sessionId, fortressId });
    if (!fortress) {
      logger.warn('[GroundBattleExtension] Fortress not found', { fortressId });
      return null;
    }
    
    const state: FortressDefenseState = {
      fortressId,
      wallIntegrity: 100,
      shieldPower: 100,
      garrisonStrength: (fortress as any).garrisonCount || fortress.troopCount || 0,
      turretCount: (fortress as any).defenseRating ? Math.floor((fortress as any).defenseRating / 10) : 5,
      turretDamage: FORTRESS_COMBAT_CONSTANTS.TURRET_BASE_DAMAGE,
      breachedSections: [],
      isUnderSiege: false,
      siegeDuration: 0,
    };
    
    logger.info('[GroundBattleExtension] Fortress defense initialized', {
      fortressId,
      turretCount: state.turretCount,
      garrisonStrength: state.garrisonStrength,
    });
    
    return state;
  }
  
  /**
   * 포위 시작
   */
  startSiege(defenseState: FortressDefenseState): FortressDefenseState {
    return {
      ...defenseState,
      isUnderSiege: true,
      siegeDuration: 0,
    };
  }
  
  /**
   * 포위 틱 처리
   */
  processSiegeTick(
    defenseState: FortressDefenseState
  ): {
    state: FortressDefenseState;
    moraleLoss: number;
    supplyLoss: number;
  } {
    if (!defenseState.isUnderSiege) {
      return { state: defenseState, moraleLoss: 0, supplyLoss: 0 };
    }
    
    const newDuration = defenseState.siegeDuration + 1;
    const moraleLoss = FORTRESS_COMBAT_CONSTANTS.SIEGE_MORALE_DRAIN;
    const supplyLoss = FORTRESS_COMBAT_CONSTANTS.SUPPLY_DRAIN_RATE;
    
    return {
      state: {
        ...defenseState,
        siegeDuration: newDuration,
      },
      moraleLoss,
      supplyLoss,
    };
  }
  
  /**
   * 요새 공격 (돌파 시도)
   */
  async assaultFortress(
    attackerUnits: IGroundUnit[],
    defenseState: FortressDefenseState
  ): Promise<FortressAssaultResult> {
    // 공격력 계산
    let totalAttackPower = 0;
    for (const unit of attackerUnits) {
      if (!unit.isDestroyed && !unit.isRetreating) {
        // 척탄병은 요새 공격에 보너스
        const bonus = unit.type === 'grenadier' ? 1.5 : 1.0;
        totalAttackPower += unit.stats.attack * unit.count * bonus;
      }
    }
    
    // 포탑 반격 피해
    const turretDamage = defenseState.turretCount * defenseState.turretDamage;
    let attackerCasualties = 0;
    
    // 공격 유닛에 포탑 피해 분배
    const aliveAttackers = attackerUnits.filter(u => !u.isDestroyed && !u.isRetreating);
    if (aliveAttackers.length > 0) {
      const damagePerUnit = Math.floor(turretDamage / aliveAttackers.length);
      for (const unit of aliveAttackers) {
        unit.stats.hp -= damagePerUnit;
        unit.damageTaken += damagePerUnit;
        
        if (unit.stats.hp <= 0) {
          const casualties = Math.ceil(unit.count * 0.2);
          unit.count = Math.max(0, unit.count - casualties);
          unit.stats.hp = unit.stats.maxHp;
          attackerCasualties += casualties;
          
          if (unit.count <= 0) {
            unit.isDestroyed = true;
          }
        }
      }
    }
    
    // 방어막 피해
    let shieldDamage = 0;
    if (defenseState.shieldPower > 0) {
      shieldDamage = Math.min(defenseState.shieldPower, totalAttackPower * 0.3);
      defenseState.shieldPower -= shieldDamage;
      totalAttackPower -= shieldDamage * 2; // 방어막이 더 효율적으로 흡수
    }
    
    // 성벽 피해
    let wallDamage = 0;
    if (totalAttackPower > 0) {
      wallDamage = totalAttackPower / FORTRESS_COMBAT_CONSTANTS.WALL_BASE_HP * 100;
      defenseState.wallIntegrity = Math.max(0, defenseState.wallIntegrity - wallDamage);
    }
    
    // 수비대 피해
    const defenderCasualties = Math.floor(totalAttackPower * 0.01 * defenseState.garrisonStrength);
    defenseState.garrisonStrength = Math.max(0, defenseState.garrisonStrength - defenderCasualties);
    
    // 돌파 판정
    let breached = false;
    let breachedSection: string | undefined;
    
    if (defenseState.wallIntegrity <= FORTRESS_COMBAT_CONSTANTS.BREACH_THRESHOLD) {
      breached = true;
      breachedSection = `section_${uuidv4().slice(0, 4)}`;
      defenseState.breachedSections.push(breachedSection);
      
      logger.info('[GroundBattleExtension] Fortress wall breached!', {
        fortressId: defenseState.fortressId,
        wallIntegrity: defenseState.wallIntegrity,
        breachedSection,
      });
    }
    
    return {
      success: breached,
      wallDamage,
      shieldDamage,
      defenderCasualties,
      attackerCasualties,
      breached,
      breachedSection,
    };
  }
  
  /**
   * 요새 내부 전투 수정자 적용
   */
  applyFortressInteriorModifiers(
    unit: IGroundUnit,
    isDefender: boolean
  ): {
    attackMod: number;
    defenseMod: number;
  } {
    const terrain = TERRAIN_EFFECTS.fortress_interior;
    const typeBonus = terrain.unitTypeBonus[unit.type] || 0;
    
    // 방어측은 요새 내부에서 추가 보너스
    const defenderBonus = isDefender ? 1.2 : 1.0;
    
    return {
      attackMod: (1 + terrain.attackBonus / 100 + typeBonus / 100) * defenderBonus,
      defenseMod: (1 + terrain.defenseBonus / 100 + typeBonus / 100) * defenderBonus,
    };
  }
  
  /**
   * 포탑 파괴
   */
  destroyTurret(defenseState: FortressDefenseState): FortressDefenseState {
    if (defenseState.turretCount <= 0) {
      return defenseState;
    }
    
    return {
      ...defenseState,
      turretCount: defenseState.turretCount - 1,
    };
  }
  
  /**
   * 요새 수리
   */
  repairFortress(
    defenseState: FortressDefenseState,
    wallRepair: number,
    shieldRepair: number
  ): FortressDefenseState {
    return {
      ...defenseState,
      wallIntegrity: Math.min(100, defenseState.wallIntegrity + wallRepair),
      shieldPower: Math.min(100, defenseState.shieldPower + shieldRepair),
    };
  }
  
  // ============================================================
  // Battle Integration
  // ============================================================
  
  /**
   * 전투에 행성 타입 수정자 적용
   */
  async applyPlanetModifiersToBattle(battle: IGroundBattle): Promise<void> {
    const planet = await Planet.findOne({ 
      sessionId: battle.sessionId, 
      planetId: battle.planetId 
    });
    
    if (!planet) {
      logger.warn('[GroundBattleExtension] Planet not found for battle', {
        battleId: battle.battleId,
        planetId: battle.planetId,
      });
      return;
    }
    
    const modifier = this.getPlanetBattleModifier(planet.type);
    
    // 특수 효과 로깅
    if (modifier.specialEffects.length > 0) {
      battle.addCombatLog({
        action: 'ATTACK',
        description: `[행성 환경] ${planet.name} (${planet.type}): ${modifier.specialEffects.join(', ')}`,
      });
    }
    
    // 허용되지 않는 유닛 필터링
    const attackerFilter = this.filterAllowedUnits(battle.attackerUnits, planet.type);
    const defenderFilter = this.filterAllowedUnits(battle.defenderUnits, planet.type);
    
    // 거부된 유닛 로그
    for (const unit of attackerFilter.rejected) {
      battle.addCombatLog({
        action: 'RETREAT',
        sourceUnitId: unit.unitId,
        description: `[강하 불가] ${GROUND_UNIT_SPECS[unit.type].nameKo}는 ${planet.type} 행성에서 작전 불가`,
      });
      unit.isDestroyed = true;
    }
    
    for (const unit of defenderFilter.rejected) {
      battle.addCombatLog({
        action: 'RETREAT',
        sourceUnitId: unit.unitId,
        description: `[배치 불가] ${GROUND_UNIT_SPECS[unit.type].nameKo}는 ${planet.type} 행성에서 방어 불가`,
      });
      unit.isDestroyed = true;
    }
  }
  
  /**
   * 전투 요약 생성
   */
  generateBattleSummary(
    battle: IGroundBattle,
    planetType: PlanetType,
    terrainId?: string
  ): {
    planetModifier: GroundBattleModifier;
    terrain?: TerrainEffect;
    attackerAdvantages: string[];
    defenderAdvantages: string[];
    warnings: string[];
  } {
    const modifier = this.getPlanetBattleModifier(planetType);
    const terrain = terrainId ? TERRAIN_EFFECTS[terrainId] : undefined;
    
    const attackerAdvantages: string[] = [];
    const defenderAdvantages: string[] = [];
    const warnings: string[] = [];
    
    // 공격/방어 수정자 분석
    if (modifier.attackModifier > 1) {
      attackerAdvantages.push(`공격력 ${Math.round((modifier.attackModifier - 1) * 100)}% 증가`);
    } else if (modifier.attackModifier < 1) {
      defenderAdvantages.push(`공격력 ${Math.round((1 - modifier.attackModifier) * 100)}% 감소`);
    }
    
    if (modifier.defenseModifier > 1) {
      defenderAdvantages.push(`방어력 ${Math.round((modifier.defenseModifier - 1) * 100)}% 증가`);
    }
    
    // 특수 효과 경고
    for (const effect of modifier.specialEffects) {
      switch (effect) {
        case 'heat_damage':
          warnings.push('열 피해: 모든 유닛이 지속 피해를 받음');
          break;
        case 'cold_damage':
          warnings.push('한파 피해: 모든 유닛이 지속 피해를 받음');
          break;
        case 'supply_penalty':
          warnings.push('보급 페널티: 보급선 유지가 어려움');
          break;
        case 'vacuum_hazard':
          warnings.push('진공 환경: 특수 장비 필요');
          break;
        case 'corridor_combat':
          warnings.push('좁은 통로: 기갑 유닛 효율 감소');
          break;
      }
    }
    
    // 지형 효과 분석
    if (terrain) {
      if (terrain.coverBonus > 0) {
        defenderAdvantages.push(`엄폐 보너스: ${terrain.coverBonus}% 피해 감소`);
      }
      if (terrain.damageOverTime) {
        warnings.push(`환경 피해: 턴당 ${terrain.damageOverTime} 피해`);
      }
    }
    
    return {
      planetModifier: modifier,
      terrain,
      attackerAdvantages,
      defenderAdvantages,
      warnings,
    };
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const groundBattleExtension = GroundBattleExtension.getInstance();






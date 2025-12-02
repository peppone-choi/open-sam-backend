/**
 * DamageCalculator - 데미지 계산 시스템
 * 
 * PHP WarUnit.php의 computeWarPower(), calcDamage() 로직을 TypeScript로 변환
 * Agent D, G가 이 모듈을 사용합니다.
 * 
 * @module core/battle/DamageCalculator
 */

import { BattleUnit3D, UnitType, TerrainType } from './types';

// ============================================================================
// 인터페이스 정의
// ============================================================================

/**
 * 데미지 계산 결과
 */
export interface DamageResult {
  baseDamage: number;
  criticalMultiplier: number;
  typeBonus: number;
  terrainBonus: number;
  finalDamage: number;
  isCritical: boolean;
  isEvaded: boolean;
  moraleDamage: number;
  effectivenessFactor: number;
}

/**
 * 전투 유닛 컨텍스트 (계산용)
 */
export interface CombatContext {
  attacker: BattleUnit3D;
  defender: BattleUnit3D;
  terrain: TerrainType;
  heightDiff: number;
  isAttackerTurn: boolean;
  phase: 'ranged' | 'melee' | 'siege' | 'tactics';
}

/**
 * 병종 상성 계수
 */
export interface TypeCoefficients {
  attackCoef: number;
  defenseCoef: number;
}

/**
 * 크리티컬/회피 계산 결과
 */
export interface CriticalEvasionResult {
  criticalChance: number;
  evasionChance: number;
  isCritical: boolean;
  isEvaded: boolean;
  criticalDamageMultiplier: number;
}

// ============================================================================
// 상수 정의
// ============================================================================

/**
 * 기본 전투력 상수 (PHP GameConst::$armperphase 참조)
 */
export const BATTLE_CONSTANTS = {
  BASE_WAR_POWER: 400,           // 기본 페이즈당 전투력
  MIN_WAR_POWER: 50,             // 최소 전투력 보장
  MAX_TRAIN: 100,                // 최대 훈련도
  MAX_MORALE: 100,               // 최대 사기
  CRITICAL_DAMAGE_MIN: 1.3,     // 최소 크리티컬 배율
  CRITICAL_DAMAGE_MAX: 2.0,     // 최대 크리티컬 배율
  DAMAGE_VARIANCE: 0.1,          // 데미지 분산 (±10%)
} as const;

/**
 * 병종 타입별 기본 상성 테이블
 * 기병 > 궁병 > 보병 > 기병
 * 공성 > 건물, 술사 > 기병
 */
export const UNIT_TYPE_COEFFICIENTS: Record<UnitType, Record<UnitType, TypeCoefficients>> = {
  [UnitType.FOOTMAN]: {
    [UnitType.FOOTMAN]: { attackCoef: 1.0, defenseCoef: 1.0 },
    [UnitType.CAVALRY]: { attackCoef: 0.7, defenseCoef: 1.3 },
    [UnitType.ARCHER]: { attackCoef: 1.3, defenseCoef: 0.8 },
    [UnitType.WIZARD]: { attackCoef: 1.0, defenseCoef: 1.0 },
    [UnitType.SIEGE]: { attackCoef: 1.2, defenseCoef: 0.9 },
  },
  [UnitType.CAVALRY]: {
    [UnitType.FOOTMAN]: { attackCoef: 1.4, defenseCoef: 0.8 },
    [UnitType.CAVALRY]: { attackCoef: 1.0, defenseCoef: 1.0 },
    [UnitType.ARCHER]: { attackCoef: 1.5, defenseCoef: 0.7 },
    [UnitType.WIZARD]: { attackCoef: 0.8, defenseCoef: 1.3 },
    [UnitType.SIEGE]: { attackCoef: 1.6, defenseCoef: 0.6 },
  },
  [UnitType.ARCHER]: {
    [UnitType.FOOTMAN]: { attackCoef: 0.8, defenseCoef: 1.2 },
    [UnitType.CAVALRY]: { attackCoef: 0.6, defenseCoef: 1.4 },
    [UnitType.ARCHER]: { attackCoef: 1.0, defenseCoef: 1.0 },
    [UnitType.WIZARD]: { attackCoef: 1.2, defenseCoef: 0.9 },
    [UnitType.SIEGE]: { attackCoef: 1.1, defenseCoef: 0.8 },
  },
  [UnitType.WIZARD]: {
    [UnitType.FOOTMAN]: { attackCoef: 1.0, defenseCoef: 1.0 },
    [UnitType.CAVALRY]: { attackCoef: 1.3, defenseCoef: 0.8 },
    [UnitType.ARCHER]: { attackCoef: 0.9, defenseCoef: 1.1 },
    [UnitType.WIZARD]: { attackCoef: 1.0, defenseCoef: 1.0 },
    [UnitType.SIEGE]: { attackCoef: 0.9, defenseCoef: 1.1 },
  },
  [UnitType.SIEGE]: {
    [UnitType.FOOTMAN]: { attackCoef: 0.9, defenseCoef: 1.1 },
    [UnitType.CAVALRY]: { attackCoef: 0.5, defenseCoef: 1.5 },
    [UnitType.ARCHER]: { attackCoef: 0.8, defenseCoef: 1.2 },
    [UnitType.WIZARD]: { attackCoef: 1.1, defenseCoef: 0.9 },
    [UnitType.SIEGE]: { attackCoef: 1.0, defenseCoef: 1.0 },
  },
};

/**
 * 지형별 보정 계수
 */
export const TERRAIN_MODIFIERS: Record<TerrainType, { attack: number; defense: number; speed: number }> = {
  [TerrainType.PLAIN]: { attack: 1.0, defense: 1.0, speed: 1.0 },
  [TerrainType.SHALLOW_WATER]: { attack: 0.8, defense: 0.9, speed: 0.7 },
  [TerrainType.DEEP_WATER]: { attack: 0.5, defense: 0.6, speed: 0.4 },
  [TerrainType.HILL_LOW]: { attack: 1.1, defense: 1.15, speed: 0.9 },
  [TerrainType.HILL_MID]: { attack: 1.15, defense: 1.25, speed: 0.8 },
  [TerrainType.HILL_HIGH]: { attack: 1.2, defense: 1.35, speed: 0.7 },
  [TerrainType.CLIFF]: { attack: 0.7, defense: 1.5, speed: 0.3 },
  [TerrainType.WALL]: { attack: 0.8, defense: 2.0, speed: 0.2 },
  [TerrainType.GATE]: { attack: 1.0, defense: 1.5, speed: 0.8 },
  [TerrainType.TOWER]: { attack: 1.3, defense: 1.8, speed: 0.5 },
  [TerrainType.SKY]: { attack: 1.1, defense: 0.8, speed: 1.5 },
};

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 랜덤 숫자 생성 (min ~ max 범위)
 */
function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * 랜덤 정수 생성
 */
function randomRangeInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1));
}

/**
 * 값 제한 (clamp)
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * DEX 로그 계산 (PHP getDexLog 참조)
 * 숙련도 차이에 따른 보정 계산
 */
function getDexLog(attackerDex: number, defenderDex: number): number {
  const dexDiff = attackerDex - defenderDex;
  const base = 1.0;
  
  // 숙련도 차이에 따른 로그 스케일 적용
  if (dexDiff > 0) {
    return base + Math.log10(dexDiff / 1000 + 1) * 0.3;
  } else if (dexDiff < 0) {
    return base - Math.log10(Math.abs(dexDiff) / 1000 + 1) * 0.2;
  }
  
  return base;
}

// ============================================================================
// DamageCalculator 클래스
// ============================================================================

/**
 * 데미지 계산기
 * PHP WarUnit의 computeWarPower(), calcDamage() 로직 구현
 */
export class DamageCalculator {
  /**
   * 기본 공격력 계산
   * PHP getComputedAttack() 참조
   * 
   * 공격력 = 무력 × (병력비 + 훈련도) × 병종보정
   */
  computeAttackPower(unit: BattleUnit3D, techLevel: number = 0): number {
    const { strength, intelligence, leadership, unitType, troops, maxTroops, training } = unit;
    
    let mainStat: number;
    let ratio: number;
    
    // 병종별 주 스탯 결정 (PHP 로직 참조)
    switch (unitType) {
      case UnitType.WIZARD:
        mainStat = intelligence * 2 - 40;
        break;
      case UnitType.SIEGE:
        mainStat = leadership * 2 - 40;
        break;
      default:
        mainStat = strength * 2 - 40;
        break;
    }
    
    // 비율 보정 (최소 10, 100 초과시 보정)
    ratio = Math.max(10, mainStat);
    if (ratio > 100) {
      ratio = 50 + ratio / 2;
    }
    
    // 병력 비율 계산
    const troopRatio = troops / maxTroops;
    
    // 기술 보정
    const techBonus = this.getTechBonus(techLevel);
    
    // 기본 공격력 + 기술 보정
    const baseAttack = BATTLE_CONSTANTS.BASE_WAR_POWER + techBonus;
    
    // 최종 공격력 = 기본공격력 × 스탯비율 × 병력비율 × 훈련도보정
    return baseAttack * (ratio / 100) * troopRatio * (training / 100);
  }

  /**
   * 기본 방어력 계산
   * PHP getComputedDefence() 참조
   * 
   * 방어력 = 통솔 × 병력 × 사기 × 지형보정
   */
  computeDefensePower(unit: BattleUnit3D, techLevel: number = 0): number {
    const { leadership, troops, maxTroops, morale, training } = unit;
    
    // 기술 보정
    const techBonus = this.getTechBonus(techLevel);
    
    // 기본 방어력 + 기술 보정
    const baseDef = BATTLE_CONSTANTS.BASE_WAR_POWER + techBonus;
    
    // 병력 비율 보정 (PHP 로직: crew / 7000 * 30 + 70)
    const crewBonus = (troops / (maxTroops / 30)) + 70;
    
    // 사기 보정
    const moraleBonus = morale / BATTLE_CONSTANTS.MAX_MORALE;
    
    // 훈련도 보정
    const trainBonus = training / BATTLE_CONSTANTS.MAX_TRAIN;
    
    return baseDef * (crewBonus / 100) * moraleBonus * trainBonus * (leadership / 100);
  }

  /**
   * 기술 보정 계산
   */
  private getTechBonus(techLevel: number): number {
    // 기술 레벨당 2% 보너스
    return techLevel * 2;
  }

  /**
   * 병종 상성 계수 조회
   */
  getTypeCoefficients(attackerType: UnitType, defenderType: UnitType): TypeCoefficients {
    return UNIT_TYPE_COEFFICIENTS[attackerType]?.[defenderType] ?? 
           { attackCoef: 1.0, defenseCoef: 1.0 };
  }

  /**
   * 지형 보정 계수 조회
   */
  getTerrainModifier(terrain: TerrainType): { attack: number; defense: number; speed: number } {
    return TERRAIN_MODIFIERS[terrain] ?? TERRAIN_MODIFIERS[TerrainType.PLAIN];
  }

  /**
   * 고도 차이 보정 계산
   */
  getHeightModifier(heightDiff: number): { attack: number; defense: number } {
    if (heightDiff > 0) {
      // 고지대 공격자 유리
      return {
        attack: 1 + Math.min(heightDiff * 0.05, 0.3),
        defense: 1 + Math.min(heightDiff * 0.025, 0.15),
      };
    } else if (heightDiff < 0) {
      // 저지대 공격자 불리
      return {
        attack: Math.max(1 + heightDiff * 0.05, 0.7),
        defense: 1.0,
      };
    }
    
    return { attack: 1.0, defense: 1.0 };
  }

  /**
   * 크리티컬/회피 판정
   * PHP getComputedCriticalRatio(), getComputedAvoidRatio() 참조
   */
  calculateCriticalEvasion(
    attacker: BattleUnit3D,
    defender: BattleUnit3D
  ): CriticalEvasionResult {
    // 크리티컬 확률 계산 (PHP 로직: 무력 65 이상부터 효과)
    let criticalChance: number;
    const { strength, intelligence, leadership, unitType: attackerType } = attacker;
    
    let mainStat: number;
    let coef: number;
    
    switch (attackerType) {
      case UnitType.WIZARD:
        mainStat = intelligence;
        coef = 0.4;
        break;
      case UnitType.SIEGE:
        mainStat = leadership;
        coef = 0.4;
        break;
      default:
        mainStat = strength;
        coef = 0.5;
        break;
    }
    
    // 65 이상부터 크리티컬 발동 (PHP: valueFit(mainstat - 65, 0))
    criticalChance = Math.max(0, mainStat - 65) * coef / 100;
    criticalChance = Math.min(0.5, criticalChance); // 최대 50%
    
    // 회피 확률 계산 (방어자)
    // PHP: avoid / 100 × train / 100
    const baseAvoid = 0.1; // 기본 회피율 10%
    let evasionChance = baseAvoid * (defender.training / 100);
    
    // 보병 상대시 회피율 감소 (PHP 로직)
    if (attackerType === UnitType.FOOTMAN) {
      evasionChance *= 0.75;
    }
    
    evasionChance = Math.min(0.4, evasionChance); // 최대 40%
    
    // 판정
    const critRoll = Math.random();
    const evadeRoll = Math.random();
    
    const isCritical = critRoll < criticalChance;
    const isEvaded = evadeRoll < evasionChance;
    
    // 크리티컬 데미지 배율 (PHP: 1.3 ~ 2.0)
    const criticalDamageMultiplier = isCritical
      ? randomRange(BATTLE_CONSTANTS.CRITICAL_DAMAGE_MIN, BATTLE_CONSTANTS.CRITICAL_DAMAGE_MAX)
      : 1.0;
    
    return {
      criticalChance,
      evasionChance,
      isCritical,
      isEvaded,
      criticalDamageMultiplier,
    };
  }

  /**
   * 전투력 계산 (PHP computeWarPower 참조)
   * 
   * 감소할 병사 = 기본전투력 + 공격력 - 방어력
   */
  computeWarPower(context: CombatContext): number {
    const { attacker, defender, terrain, heightDiff } = context;
    
    // 공격력/방어력 계산
    const attackPower = this.computeAttackPower(attacker);
    const defensePower = this.computeDefensePower(defender);
    
    // 기본 전투력 = 기본값 + 공격력 - 방어력
    let warPower = BATTLE_CONSTANTS.BASE_WAR_POWER + attackPower - defensePower;
    
    // 최소 전투력 보장 (PHP: min 100, random 50~100)
    if (warPower < 100) {
      warPower = Math.max(0, warPower);
      warPower = (warPower + 100) / 2;
      warPower = randomRangeInt(Math.floor(warPower), 100);
    }
    
    // 사기 보정 (공격자)
    warPower *= attacker.morale / BATTLE_CONSTANTS.MAX_MORALE;
    
    // 훈련도 보정 (방어자)
    warPower /= defender.training / BATTLE_CONSTANTS.MAX_TRAIN;
    
    // 병종 상성 보정
    const typeCoef = this.getTypeCoefficients(attacker.unitType, defender.unitType);
    warPower *= typeCoef.attackCoef;
    
    // 지형 보정
    const terrainMod = this.getTerrainModifier(terrain);
    warPower *= terrainMod.attack;
    
    // 고도 보정
    const heightMod = this.getHeightModifier(heightDiff);
    warPower *= heightMod.attack;
    
    return warPower;
  }

  /**
   * 최종 데미지 계산 (PHP calcDamage 참조)
   */
  calculateDamage(context: CombatContext): DamageResult {
    const { attacker, defender, terrain, heightDiff } = context;
    
    // 기본 전투력 계산
    const baseWarPower = this.computeWarPower(context);
    
    // 크리티컬/회피 판정
    const critEvasion = this.calculateCriticalEvasion(attacker, defender);
    
    // 회피 시 데미지 0
    if (critEvasion.isEvaded) {
      return {
        baseDamage: baseWarPower,
        criticalMultiplier: 1.0,
        typeBonus: this.getTypeCoefficients(attacker.unitType, defender.unitType).attackCoef,
        terrainBonus: this.getTerrainModifier(terrain).attack,
        finalDamage: 0,
        isCritical: false,
        isEvaded: true,
        moraleDamage: 0,
        effectivenessFactor: 1.0,
      };
    }
    
    // 데미지 분산 적용 (±10%)
    const variance = randomRange(
      1 - BATTLE_CONSTANTS.DAMAGE_VARIANCE,
      1 + BATTLE_CONSTANTS.DAMAGE_VARIANCE
    );
    
    // 크리티컬 적용
    let finalDamage = baseWarPower * variance * critEvasion.criticalDamageMultiplier;
    
    // 정수 반올림
    finalDamage = Math.round(finalDamage);
    
    // 최소 1 데미지 보장
    finalDamage = Math.max(1, finalDamage);
    
    // 사기 데미지 계산 (받은 데미지의 10%)
    const moraleDamage = Math.floor(finalDamage / 10);
    
    return {
      baseDamage: baseWarPower,
      criticalMultiplier: critEvasion.criticalDamageMultiplier,
      typeBonus: this.getTypeCoefficients(attacker.unitType, defender.unitType).attackCoef,
      terrainBonus: this.getTerrainModifier(terrain).attack,
      finalDamage,
      isCritical: critEvasion.isCritical,
      isEvaded: false,
      moraleDamage,
      effectivenessFactor: variance,
    };
  }

  /**
   * 상호 데미지 계산 (양측 동시 공격)
   */
  calculateMutualDamage(
    attacker: BattleUnit3D,
    defender: BattleUnit3D,
    terrain: TerrainType,
    heightDiff: number
  ): { attackerDamage: DamageResult; defenderDamage: DamageResult } {
    const attackerContext: CombatContext = {
      attacker,
      defender,
      terrain,
      heightDiff,
      isAttackerTurn: true,
      phase: 'melee',
    };
    
    const defenderContext: CombatContext = {
      attacker: defender,
      defender: attacker,
      terrain,
      heightDiff: -heightDiff,
      isAttackerTurn: false,
      phase: 'melee',
    };
    
    return {
      attackerDamage: this.calculateDamage(attackerContext),
      defenderDamage: this.calculateDamage(defenderContext),
    };
  }

  /**
   * 경험치/숙련도 계산 기반 DEX 보정
   */
  calculateDexModifier(attackerDex: number, defenderDex: number): number {
    return getDexLog(attackerDex, defenderDex);
  }

  /**
   * 사기 붕괴 확률 계산
   */
  calculateMoraleCollapseChance(morale: number, casualties: number, maxTroops: number): number {
    const casualtyRatio = casualties / maxTroops;
    const moraleRatio = morale / BATTLE_CONSTANTS.MAX_MORALE;
    
    // 사기가 낮고 피해가 클수록 붕괴 확률 증가
    if (morale <= 20) {
      return (100 - morale) / 100;
    }
    
    if (casualtyRatio > 0.3) {
      return casualtyRatio * (1 - moraleRatio);
    }
    
    return 0;
  }
}

// 싱글톤 인스턴스 export
export const damageCalculator = new DamageCalculator();



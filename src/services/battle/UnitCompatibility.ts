/**
 * UnitCompatibility.ts
 * 병종 상성 시스템
 * 
 * 상성 관계:
 * - 보병(1100) < 기병(1300): 기병이 보병에게 유리
 * - 기병(1300) < 궁병(1200): 궁병이 기병에게 유리  
 * - 궁병(1200) < 보병(1100): 보병이 궁병에게 유리
 * - 책사(1400): 특수 상성
 * - 공성(1500): 건물에 유리
 */

import { 
  UnitCategory, 
  getUnitCategory,
  TerrainType,
  TerrainEffect,
  TurnBasedUnit
} from './TurnBasedBattle.types';

// ============================================================================
// 상성 배수 정의
// ============================================================================

/** 상성 유리 시 배수 */
export const ADVANTAGE_MULTIPLIER = 1.3;

/** 상성 불리 시 배수 */
export const DISADVANTAGE_MULTIPLIER = 0.7;

/** 동등 시 배수 */
export const NEUTRAL_MULTIPLIER = 1.0;

/**
 * 기본 병종 상성 테이블
 * [공격자][방어자] = 배수
 * 
 * 보병 > 궁병 > 기병 > 보병 (가위바위보)
 */
export const UNIT_COMPATIBILITY_TABLE: Record<UnitCategory, Record<UnitCategory, number>> = {
  infantry: {
    infantry: 1.0,
    cavalry: 0.7,      // 보병은 기병에게 불리
    archer: 1.3,       // 보병은 궁병에게 유리
    wizard: 1.0,
    siege: 1.1,
    navy: 1.0,
  },
  cavalry: {
    infantry: 1.3,     // 기병은 보병에게 유리
    cavalry: 1.0,
    archer: 0.7,       // 기병은 궁병에게 불리
    wizard: 1.2,       // 기병은 책사에게 약간 유리
    siege: 1.5,        // 기병은 공성에게 유리
    navy: 0.8,
  },
  archer: {
    infantry: 0.7,     // 궁병은 보병에게 불리
    cavalry: 1.3,      // 궁병은 기병에게 유리
    archer: 1.0,
    wizard: 0.9,
    siege: 0.9,
    navy: 1.1,
  },
  wizard: {
    infantry: 1.0,
    cavalry: 0.8,      // 책사는 기병에게 불리
    archer: 1.1,
    wizard: 1.0,
    siege: 0.8,
    navy: 1.0,
  },
  siege: {
    infantry: 0.9,
    cavalry: 0.5,      // 공성은 기병에게 매우 불리
    archer: 1.0,
    wizard: 1.1,
    siege: 1.0,
    navy: 0.8,
  },
  navy: {
    infantry: 1.0,
    cavalry: 1.2,
    archer: 0.9,
    wizard: 1.0,
    siege: 1.2,
    navy: 1.0,
  },
};

/**
 * 특수 병종 상성 (세부 병종 ID별)
 * 특정 병종끼리의 추가 보정
 */
export const SPECIAL_COMPATIBILITY: Record<number, Record<number, number>> = {
  // 장창병(1108)은 기병에게 추가 유리
  1108: {
    1300: 1.5, 1301: 1.5, 1302: 1.5, 1303: 1.5, 1304: 1.5, 1305: 1.5,
  },
  // 등갑병(1401)은 궁병에게 매우 유리, 화염에 약함
  1401: {
    1200: 1.8, 1201: 1.8, 1202: 1.8, 1203: 1.8, 1204: 1.8, 1205: 1.8,
  },
  // 서량철기(1305)는 보병에게 추가 유리
  1305: {
    1100: 1.6, 1101: 1.6, 1102: 1.6, 1103: 1.6, 1104: 1.6,
  },
  // 호표기(1304)는 모든 기병에게 유리
  1304: {
    1300: 1.3, 1301: 1.3, 1302: 1.3, 1303: 1.3, 1305: 1.2, 1306: 1.2,
  },
  // 황건역사(1114)는 보병에게 추가 유리
  1114: {
    1100: 1.4, 1101: 1.4, 1102: 1.3,
  },
  // 코끼리병(1403, 1404)은 보병/기병에게 유리
  1403: {
    1100: 1.5, 1101: 1.5, 1102: 1.5, 1300: 1.3, 1301: 1.3,
  },
  1404: {
    1100: 1.6, 1101: 1.6, 1102: 1.6, 1300: 1.4, 1301: 1.4,
  },
};

// ============================================================================
// 상성 계산 함수
// ============================================================================

/**
 * 병종 상성 배수 계산
 * @param attackerCrewTypeId 공격자 병종 ID
 * @param defenderCrewTypeId 방어자 병종 ID
 * @returns 상성 배수 (1.0 = 동등)
 */
export function getCompatibilityModifier(
  attackerCrewTypeId: number,
  defenderCrewTypeId: number
): number {
  // 1. 특수 상성 체크
  const specialMod = SPECIAL_COMPATIBILITY[attackerCrewTypeId]?.[defenderCrewTypeId];
  if (specialMod !== undefined) {
    return specialMod;
  }

  // 2. 기본 카테고리 상성
  const attackerCategory = getUnitCategory(attackerCrewTypeId);
  const defenderCategory = getUnitCategory(defenderCrewTypeId);

  return UNIT_COMPATIBILITY_TABLE[attackerCategory]?.[defenderCategory] ?? 1.0;
}

/**
 * 상성 설명 텍스트 생성
 */
export function getCompatibilityDescription(
  attackerCrewTypeId: number,
  defenderCrewTypeId: number
): string {
  const modifier = getCompatibilityModifier(attackerCrewTypeId, defenderCrewTypeId);
  
  if (modifier >= 1.5) return '압도적 유리';
  if (modifier >= 1.3) return '상성 유리';
  if (modifier >= 1.1) return '약간 유리';
  if (modifier >= 0.9) return '동등';
  if (modifier >= 0.7) return '상성 불리';
  return '압도적 불리';
}

/**
 * 유닛 간 상성 정보
 */
export interface CompatibilityInfo {
  modifier: number;
  description: string;
  attackerCategory: UnitCategory;
  defenderCategory: UnitCategory;
  isAdvantage: boolean;
  isDisadvantage: boolean;
}

/**
 * 상성 정보 조회
 */
export function getCompatibilityInfo(
  attackerCrewTypeId: number,
  defenderCrewTypeId: number
): CompatibilityInfo {
  const modifier = getCompatibilityModifier(attackerCrewTypeId, defenderCrewTypeId);
  const attackerCategory = getUnitCategory(attackerCrewTypeId);
  const defenderCategory = getUnitCategory(defenderCrewTypeId);

  return {
    modifier,
    description: getCompatibilityDescription(attackerCrewTypeId, defenderCrewTypeId),
    attackerCategory,
    defenderCategory,
    isAdvantage: modifier >= ADVANTAGE_MULTIPLIER,
    isDisadvantage: modifier <= DISADVANTAGE_MULTIPLIER,
  };
}

// ============================================================================
// 지형 효과
// ============================================================================

/**
 * 지형 효과 테이블
 */
export const TERRAIN_EFFECTS: Record<TerrainType, TerrainEffect> = {
  plain: {
    moveCost: 1.0,
    defenseBonus: 0,
    attackPenalty: 0,
    passable: true,
    cavalryPassable: true,
    description: '평지: 제한 없음',
  },
  forest: {
    moveCost: 1.5,
    defenseBonus: 20,
    attackPenalty: 10,
    passable: true,
    cavalryPassable: true,
    description: '숲: 방어 +20%, 공격 -10%, 기병 이동 제한',
  },
  hill: {
    moveCost: 2.0,
    defenseBonus: 30,
    attackPenalty: 0,
    passable: true,
    cavalryPassable: true,
    description: '언덕: 방어 +30%, 높은 곳에서 공격 보너스',
  },
  mountain: {
    moveCost: 3.0,
    defenseBonus: 50,
    attackPenalty: 20,
    passable: true,
    cavalryPassable: false,
    description: '산: 방어 +50%, 기병 통행 불가',
  },
  water: {
    moveCost: 999,
    defenseBonus: -20,
    attackPenalty: 30,
    passable: false,
    cavalryPassable: false,
    description: '물: 통행 불가 (수군 제외)',
  },
  swamp: {
    moveCost: 2.5,
    defenseBonus: -10,
    attackPenalty: 20,
    passable: true,
    cavalryPassable: false,
    description: '늪: 방어 -10%, 공격 -20%, 기병 통행 불가',
  },
  castle: {
    moveCost: 1.0,
    defenseBonus: 50,
    attackPenalty: 0,
    passable: true,
    cavalryPassable: true,
    description: '성: 방어 +50%',
  },
  road: {
    moveCost: 0.8,
    defenseBonus: -10,
    attackPenalty: 0,
    passable: true,
    cavalryPassable: true,
    description: '도로: 이동 빠름, 방어 -10%',
  },
};

/**
 * 지형 효과 조회
 */
export function getTerrainEffect(terrain: TerrainType): TerrainEffect {
  return TERRAIN_EFFECTS[terrain] || TERRAIN_EFFECTS.plain;
}

/**
 * 지형 방어 보정 계산
 */
export function getTerrainDefenseModifier(terrain: TerrainType): number {
  const effect = getTerrainEffect(terrain);
  return 1.0 + (effect.defenseBonus / 100);
}

/**
 * 지형 공격 보정 계산
 */
export function getTerrainAttackModifier(terrain: TerrainType): number {
  const effect = getTerrainEffect(terrain);
  return 1.0 - (effect.attackPenalty / 100);
}

/**
 * 유닛이 지형을 통과할 수 있는지 확인
 */
export function canPassTerrain(unit: TurnBasedUnit, terrain: TerrainType): boolean {
  const effect = getTerrainEffect(terrain);
  
  if (!effect.passable) {
    // 수군은 물 통과 가능
    if (terrain === 'water' && unit.category === 'navy') {
      return true;
    }
    return false;
  }

  // 기병은 특정 지형 통과 불가
  if (unit.category === 'cavalry' && !effect.cavalryPassable) {
    return false;
  }

  return true;
}

/**
 * 이동 비용 계산
 */
export function getMoveCost(unit: TurnBasedUnit, terrain: TerrainType): number {
  const effect = getTerrainEffect(terrain);
  
  // 기병은 숲에서 추가 페널티
  if (unit.category === 'cavalry' && terrain === 'forest') {
    return effect.moveCost * 1.5;
  }

  // 수군은 물에서 정상 이동
  if (unit.category === 'navy' && terrain === 'water') {
    return 1.0;
  }

  return effect.moveCost;
}

// ============================================================================
// 고도 보정
// ============================================================================

/**
 * 고도 차이에 따른 공격력 보정
 * 높은 곳에서 낮은 곳으로 공격 시 유리
 */
export function getElevationModifier(
  attackerElevation: number,
  defenderElevation: number
): number {
  const diff = attackerElevation - defenderElevation;
  
  if (diff > 0) {
    // 높은 곳에서 공격: 유리
    return 1.0 + Math.min(diff * 0.1, 0.5); // 최대 50% 보너스
  } else if (diff < 0) {
    // 낮은 곳에서 공격: 불리
    return 1.0 + Math.max(diff * 0.05, -0.3); // 최대 30% 페널티
  }
  
  return 1.0;
}

/**
 * 궁병 사거리 보정 (고도)
 */
export function getArcherRangeBonus(
  attackerElevation: number,
  defenderElevation: number
): number {
  const diff = attackerElevation - defenderElevation;
  
  if (diff > 0) {
    return Math.floor(diff / 2); // 고도 2당 사거리 +1
  }
  
  return 0;
}

// ============================================================================
// 병종별 특수 능력
// ============================================================================

/** 병종 특수 능력 */
export interface UnitSpecialAbility {
  id: string;
  name: string;
  description: string;
  effect: (attacker: TurnBasedUnit, defender: TurnBasedUnit) => number;
}

/**
 * 병종별 특수 능력 정의
 */
export const UNIT_SPECIAL_ABILITIES: Record<number, UnitSpecialAbility[]> = {
  // 장창병(1108) - 대기병 특화
  1108: [{
    id: 'anti_cavalry',
    name: '창벽',
    description: '기병 돌격 시 선제 피해',
    effect: (attacker, defender) => {
      if (defender.category === 'cavalry') {
        return 0.3; // 기병에게 30% 추가 피해
      }
      return 0;
    },
  }],
  
  // 등갑병(1401) - 물리 방어 특화
  1401: [{
    id: 'armor_plating',
    name: '등갑',
    description: '물리 피해 감소, 화염 취약',
    effect: (attacker, defender) => {
      if (attacker.category === 'archer' || attacker.category === 'infantry') {
        return -0.3; // 30% 피해 감소
      }
      return 0;
    },
  }],
  
  // 호표기(1304) - 기병 킬러
  1304: [{
    id: 'cavalry_hunter',
    name: '호표',
    description: '기병에게 추가 피해',
    effect: (attacker, defender) => {
      if (defender.category === 'cavalry') {
        return 0.25;
      }
      return 0;
    },
  }],
};

/**
 * 특수 능력 적용
 */
export function applySpecialAbilities(
  attacker: TurnBasedUnit,
  defender: TurnBasedUnit
): number {
  const abilities = UNIT_SPECIAL_ABILITIES[attacker.crewTypeId] || [];
  
  let totalModifier = 0;
  for (const ability of abilities) {
    totalModifier += ability.effect(attacker, defender);
  }
  
  return 1.0 + totalModifier;
}





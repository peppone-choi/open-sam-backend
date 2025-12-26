/**
 * 병종별 전투 특성 정의
 * 각 병종의 전투 관련 보너스, 페널티, 특수 능력 등
 */

import { ARM_TYPE } from '../../const/GameUnitConst';
import { TerrainType, WeatherType, BattleType } from '../engines/BattleType';

/**
 * 병종별 전투 특성 인터페이스
 */
export interface CrewCombatTraits {
  /** 병종 ID */
  armType: number;
  /** 병종 이름 */
  name: string;
  /** 기본 이동력 */
  baseMovePoints: number;
  /** 기본 사거리 */
  baseRange: number;
  /** 선제공격 가능 여부 */
  canPreemptiveStrike: boolean;
  /** 반격 가능 여부 */
  canCounterAttack: boolean;
  /** 추격 보너스 */
  pursuitBonus: number;
  /** 퇴각 페널티 */
  retreatPenalty: number;
  /** 공성전 공격 보너스 */
  siegeAttackBonus: number;
  /** 공성전 방어 보너스 */
  siegeDefenseBonus: number;
  /** 수비전 보너스 */
  defenseBonus: number;
  /** 야전 보너스 */
  fieldBonus: number;
  /** 지형별 보정 */
  terrainModifiers: Record<TerrainType, number>;
  /** 날씨별 보정 */
  weatherModifiers: Record<WeatherType, number>;
  /** 특수 능력 */
  specialAbilities: CrewSpecialAbility[];
  /** 상성 (유리한 병종) */
  strongAgainst: number[];
  /** 상성 (불리한 병종) */
  weakAgainst: number[];
}

/**
 * 병종 특수 능력
 */
export interface CrewSpecialAbility {
  /** 능력 ID */
  id: string;
  /** 능력 이름 */
  name: string;
  /** 설명 */
  description: string;
  /** 발동 확률 (0-1) */
  triggerChance: number;
  /** 효과 타입 */
  effectType: 'damage' | 'buff' | 'debuff' | 'heal' | 'special';
  /** 효과 값 */
  effectValue: number;
  /** 발동 조건 */
  condition?: CrewAbilityCondition;
}

export interface CrewAbilityCondition {
  /** 페이즈 조건 */
  phase?: 'approach' | 'combat' | 'retreat';
  /** 전투 타입 조건 */
  battleType?: BattleType;
  /** HP 조건 (비율) */
  hpRatio?: { min?: number; max?: number };
  /** 사기 조건 */
  atmosRatio?: { min?: number; max?: number };
}

/**
 * 보병 전투 특성
 */
const FOOTMAN_TRAITS: CrewCombatTraits = {
  armType: ARM_TYPE.FOOTMAN,
  name: '보병',
  baseMovePoints: 7,
  baseRange: 1,
  canPreemptiveStrike: false,
  canCounterAttack: true,
  pursuitBonus: 0,
  retreatPenalty: 0.1,
  siegeAttackBonus: 0,
  siegeDefenseBonus: 0.2, // 성벽 방어 시 유리
  defenseBonus: 0.1,
  fieldBonus: 0,
  terrainModifiers: {
    [TerrainType.PLAIN]: 1.0,
    [TerrainType.MOUNTAIN]: 0.9,
    [TerrainType.WATER]: 0.7,
    [TerrainType.WALL]: 1.1,
    [TerrainType.GATE]: 1.0,
    [TerrainType.INNER_CASTLE]: 1.1
  },
  weatherModifiers: {
    [WeatherType.CLEAR]: 1.0,
    [WeatherType.RAIN]: 0.95,
    [WeatherType.SNOW]: 0.9,
    [WeatherType.FOG]: 1.0,
    [WeatherType.WIND]: 1.0
  },
  specialAbilities: [
    {
      id: 'shield_wall',
      name: '방패진',
      description: '밀집 대형으로 방어력 상승',
      triggerChance: 0.2,
      effectType: 'buff',
      effectValue: 0.15,
      condition: { phase: 'combat' }
    },
    {
      id: 'hold_ground',
      name: '사수',
      description: '수비 시 퇴각 확률 감소',
      triggerChance: 0.25,
      effectType: 'special',
      effectValue: 0.3,
      condition: { battleType: BattleType.DEFENSE }
    }
  ],
  strongAgainst: [ARM_TYPE.CAVALRY],
  weakAgainst: [ARM_TYPE.ARCHER]
};

/**
 * 궁병 전투 특성
 */
const ARCHER_TRAITS: CrewCombatTraits = {
  armType: ARM_TYPE.ARCHER,
  name: '궁병',
  baseMovePoints: 6,
  baseRange: 3,
  canPreemptiveStrike: true,
  canCounterAttack: false,
  pursuitBonus: 0.3, // 원거리 추격 가능
  retreatPenalty: 0.2, // 근접전에 약함
  siegeAttackBonus: 0.3, // 성벽 위에서 유리
  siegeDefenseBonus: 0.4, // 성벽 방어 시 매우 유리
  defenseBonus: 0.2,
  fieldBonus: 0,
  terrainModifiers: {
    [TerrainType.PLAIN]: 1.0,
    [TerrainType.MOUNTAIN]: 1.1, // 고지대 유리
    [TerrainType.WATER]: 0.6,
    [TerrainType.WALL]: 1.3, // 성벽 위 매우 유리
    [TerrainType.GATE]: 0.9,
    [TerrainType.INNER_CASTLE]: 1.0
  },
  weatherModifiers: {
    [WeatherType.CLEAR]: 1.0,
    [WeatherType.RAIN]: 0.7, // 비에 약함 (활시위)
    [WeatherType.SNOW]: 0.8,
    [WeatherType.FOG]: 0.6, // 안개에 약함 (시야)
    [WeatherType.WIND]: 0.85 // 바람에 약함 (화살 궤도)
  },
  specialAbilities: [
    {
      id: 'volley_fire',
      name: '일제사격',
      description: '집중 사격으로 대미지 증가',
      triggerChance: 0.15,
      effectType: 'damage',
      effectValue: 0.4
    },
    {
      id: 'preemptive_shot',
      name: '선제사격',
      description: '전투 시작 시 선제 공격',
      triggerChance: 0.3,
      effectType: 'special',
      effectValue: 0.5,
      condition: { phase: 'approach' }
    },
    {
      id: 'suppressive_fire',
      name: '제압사격',
      description: '적 사기 감소',
      triggerChance: 0.2,
      effectType: 'debuff',
      effectValue: 5
    }
  ],
  strongAgainst: [ARM_TYPE.FOOTMAN],
  weakAgainst: [ARM_TYPE.CAVALRY]
};

/**
 * 기병 전투 특성
 */
const CAVALRY_TRAITS: CrewCombatTraits = {
  armType: ARM_TYPE.CAVALRY,
  name: '기병',
  baseMovePoints: 12,
  baseRange: 1,
  canPreemptiveStrike: true, // 돌격
  canCounterAttack: true,
  pursuitBonus: 0.6, // 추격에 매우 유리
  retreatPenalty: 0.05, // 퇴각 손실 적음
  siegeAttackBonus: -0.2, // 공성전에 불리
  siegeDefenseBonus: -0.1,
  defenseBonus: -0.1, // 수비전에 불리
  fieldBonus: 0.2, // 야전에 유리
  terrainModifiers: {
    [TerrainType.PLAIN]: 1.2, // 평지에서 강함
    [TerrainType.MOUNTAIN]: 0.6, // 산지에서 약함
    [TerrainType.WATER]: 0.4, // 수전 불가
    [TerrainType.WALL]: 0.5, // 성벽에서 약함
    [TerrainType.GATE]: 0.8,
    [TerrainType.INNER_CASTLE]: 0.6
  },
  weatherModifiers: {
    [WeatherType.CLEAR]: 1.0,
    [WeatherType.RAIN]: 0.85, // 진흙
    [WeatherType.SNOW]: 0.75, // 눈
    [WeatherType.FOG]: 0.95,
    [WeatherType.WIND]: 1.0
  },
  specialAbilities: [
    {
      id: 'charge',
      name: '돌격',
      description: '전투 시작 시 강력한 돌격',
      triggerChance: 0.25,
      effectType: 'damage',
      effectValue: 0.3,
      condition: { phase: 'approach' }
    },
    {
      id: 'flanking',
      name: '측면공격',
      description: '적 방어력 무시 공격',
      triggerChance: 0.15,
      effectType: 'special',
      effectValue: 0.5
    },
    {
      id: 'swift_retreat',
      name: '신속퇴각',
      description: '퇴각 시 손실 최소화',
      triggerChance: 0.4,
      effectType: 'special',
      effectValue: 0.5,
      condition: { phase: 'retreat' }
    }
  ],
  strongAgainst: [ARM_TYPE.ARCHER],
  weakAgainst: [ARM_TYPE.FOOTMAN]
};

/**
 * 귀병(술사) 전투 특성
 */
const WIZARD_TRAITS: CrewCombatTraits = {
  armType: ARM_TYPE.WIZARD,
  name: '귀병',
  baseMovePoints: 5,
  baseRange: 2,
  canPreemptiveStrike: true,
  canCounterAttack: false,
  pursuitBonus: 0,
  retreatPenalty: 0.3,
  siegeAttackBonus: 0.2, // 화공 등
  siegeDefenseBonus: 0.1,
  defenseBonus: 0,
  fieldBonus: 0.1,
  terrainModifiers: {
    [TerrainType.PLAIN]: 1.0,
    [TerrainType.MOUNTAIN]: 1.1,
    [TerrainType.WATER]: 0.8,
    [TerrainType.WALL]: 1.0,
    [TerrainType.GATE]: 1.0,
    [TerrainType.INNER_CASTLE]: 1.0
  },
  weatherModifiers: {
    [WeatherType.CLEAR]: 1.0,
    [WeatherType.RAIN]: 0.6, // 화공 불가
    [WeatherType.SNOW]: 0.8,
    [WeatherType.FOG]: 1.1, // 안개 활용
    [WeatherType.WIND]: 1.2 // 바람으로 화공 강화
  },
  specialAbilities: [
    {
      id: 'fire_attack',
      name: '화공',
      description: '화염 공격으로 대미지 증가',
      triggerChance: 0.2,
      effectType: 'damage',
      effectValue: 0.5,
      condition: {
        battleType: BattleType.SIEGE
      }
    },
    {
      id: 'confusion',
      name: '혼란',
      description: '적 부대 혼란 유발',
      triggerChance: 0.15,
      effectType: 'debuff',
      effectValue: 10
    },
    {
      id: 'morale_boost',
      name: '격려',
      description: '아군 사기 상승',
      triggerChance: 0.2,
      effectType: 'buff',
      effectValue: 8
    }
  ],
  strongAgainst: [ARM_TYPE.SIEGE],
  weakAgainst: [ARM_TYPE.CAVALRY]
};

/**
 * 차병(공성병기) 전투 특성
 */
const SIEGE_TRAITS: CrewCombatTraits = {
  armType: ARM_TYPE.SIEGE,
  name: '차병',
  baseMovePoints: 3,
  baseRange: 4,
  canPreemptiveStrike: true, // 원거리 선제
  canCounterAttack: false,
  pursuitBonus: -0.5, // 추격 불가
  retreatPenalty: 0.5, // 퇴각 시 큰 손실
  siegeAttackBonus: 0.8, // 공성전 핵심
  siegeDefenseBonus: -0.3, // 수비전에 불리
  defenseBonus: -0.2,
  fieldBonus: -0.3, // 야전에 불리
  terrainModifiers: {
    [TerrainType.PLAIN]: 0.9,
    [TerrainType.MOUNTAIN]: 0.4,
    [TerrainType.WATER]: 0.3,
    [TerrainType.WALL]: 1.5, // 성벽 공격에 강함
    [TerrainType.GATE]: 1.8, // 성문 공격에 매우 강함
    [TerrainType.INNER_CASTLE]: 1.2
  },
  weatherModifiers: {
    [WeatherType.CLEAR]: 1.0,
    [WeatherType.RAIN]: 0.7,
    [WeatherType.SNOW]: 0.6,
    [WeatherType.FOG]: 0.8,
    [WeatherType.WIND]: 1.1 // 투석기 등에 유리
  },
  specialAbilities: [
    {
      id: 'wall_breaker',
      name: '파성',
      description: '성벽 내구도 감소',
      triggerChance: 0.3,
      effectType: 'damage',
      effectValue: 1.0,
      condition: { battleType: BattleType.SIEGE }
    },
    {
      id: 'gate_ram',
      name: '충차',
      description: '성문 공격력 증가',
      triggerChance: 0.25,
      effectType: 'damage',
      effectValue: 0.8,
      condition: { battleType: BattleType.SIEGE }
    },
    {
      id: 'bombardment',
      name: '포격',
      description: '광역 대미지',
      triggerChance: 0.2,
      effectType: 'damage',
      effectValue: 0.6
    }
  ],
  strongAgainst: [ARM_TYPE.CASTLE],
  weakAgainst: [ARM_TYPE.CAVALRY, ARM_TYPE.WIZARD]
};

/**
 * 성벽 전투 특성
 */
const CASTLE_TRAITS: CrewCombatTraits = {
  armType: ARM_TYPE.CASTLE,
  name: '성벽',
  baseMovePoints: 0,
  baseRange: 2,
  canPreemptiveStrike: true,
  canCounterAttack: true,
  pursuitBonus: -1, // 추격 불가
  retreatPenalty: 0,
  siegeAttackBonus: -1, // 공격 불가
  siegeDefenseBonus: 1.0, // 방어 전문
  defenseBonus: 1.0,
  fieldBonus: -1, // 야전 불가
  terrainModifiers: {
    [TerrainType.PLAIN]: 0,
    [TerrainType.MOUNTAIN]: 0,
    [TerrainType.WATER]: 0,
    [TerrainType.WALL]: 1.0,
    [TerrainType.GATE]: 0.8,
    [TerrainType.INNER_CASTLE]: 1.2
  },
  weatherModifiers: {
    [WeatherType.CLEAR]: 1.0,
    [WeatherType.RAIN]: 1.1, // 비 올 때 공성 불리
    [WeatherType.SNOW]: 1.1,
    [WeatherType.FOG]: 1.0,
    [WeatherType.WIND]: 0.9 // 화공에 취약
  },
  specialAbilities: [
    {
      id: 'arrow_storm',
      name: '화살비',
      description: '성벽에서 화살 공격',
      triggerChance: 0.3,
      effectType: 'damage',
      effectValue: 0.4
    },
    {
      id: 'boiling_oil',
      name: '끓는기름',
      description: '성문 방어 시 추가 대미지',
      triggerChance: 0.25,
      effectType: 'damage',
      effectValue: 0.6
    },
    {
      id: 'fortification',
      name: '방어태세',
      description: '성벽 방어력 증가',
      triggerChance: 0.2,
      effectType: 'buff',
      effectValue: 0.2
    }
  ],
  strongAgainst: [],
  weakAgainst: [ARM_TYPE.SIEGE]
};

/**
 * 병종별 특성 맵
 */
export const CREW_COMBAT_TRAITS: Record<number, CrewCombatTraits> = {
  [ARM_TYPE.CASTLE]: CASTLE_TRAITS,
  [ARM_TYPE.FOOTMAN]: FOOTMAN_TRAITS,
  [ARM_TYPE.ARCHER]: ARCHER_TRAITS,
  [ARM_TYPE.CAVALRY]: CAVALRY_TRAITS,
  [ARM_TYPE.WIZARD]: WIZARD_TRAITS,
  [ARM_TYPE.SIEGE]: SIEGE_TRAITS
};

/**
 * 병종 특성 조회
 */
export function getCrewCombatTraits(armType: number): CrewCombatTraits | null {
  return CREW_COMBAT_TRAITS[armType] ?? null;
}

/**
 * 지형 보정 계수 조회
 */
export function getTerrainModifier(armType: number, terrain: TerrainType): number {
  const traits = CREW_COMBAT_TRAITS[armType];
  return traits?.terrainModifiers[terrain] ?? 1.0;
}

/**
 * 날씨 보정 계수 조회
 */
export function getWeatherModifier(armType: number, weather: WeatherType): number {
  const traits = CREW_COMBAT_TRAITS[armType];
  return traits?.weatherModifiers[weather] ?? 1.0;
}

/**
 * 상성 보정 계수 조회
 */
export function getCrewAdvantage(attackerType: number, defenderType: number): number {
  const attackerTraits = CREW_COMBAT_TRAITS[attackerType];
  if (!attackerTraits) return 1.0;

  if (attackerTraits.strongAgainst.includes(defenderType)) {
    return 1.2; // 유리 상성
  }
  if (attackerTraits.weakAgainst.includes(defenderType)) {
    return 0.8; // 불리 상성
  }
  return 1.0;
}

/**
 * 전투 타입별 보정 계수 조회
 */
export function getBattleTypeModifier(armType: number, battleType: BattleType): number {
  const traits = CREW_COMBAT_TRAITS[armType];
  if (!traits) return 1.0;

  switch (battleType) {
    case BattleType.SIEGE:
      return 1.0 + traits.siegeAttackBonus;
    case BattleType.DEFENSE:
      return 1.0 + traits.defenseBonus;
    case BattleType.FIELD:
    default:
      return 1.0 + traits.fieldBonus;
  }
}

/**
 * 추격 보정 계수 조회
 */
export function getPursuitModifier(armType: number): number {
  const traits = CREW_COMBAT_TRAITS[armType];
  return 1.0 + (traits?.pursuitBonus ?? 0);
}

/**
 * 퇴각 페널티 조회
 */
export function getRetreatPenalty(armType: number): number {
  const traits = CREW_COMBAT_TRAITS[armType];
  return traits?.retreatPenalty ?? 0.1;
}

/**
 * 특수 능력 발동 체크
 */
export function checkSpecialAbility(
  armType: number,
  abilityId: string,
  context: {
    phase?: 'approach' | 'combat' | 'retreat';
    battleType?: BattleType;
    hpRatio?: number;
    atmosRatio?: number;
  },
  rng: { nextBool: (chance: number) => boolean }
): { triggered: boolean; ability: CrewSpecialAbility | null } {
  const traits = CREW_COMBAT_TRAITS[armType];
  if (!traits) return { triggered: false, ability: null };

  const ability = traits.specialAbilities.find(a => a.id === abilityId);
  if (!ability) return { triggered: false, ability: null };

  // 조건 체크
  if (ability.condition) {
    if (ability.condition.phase && ability.condition.phase !== context.phase) {
      return { triggered: false, ability: null };
    }
    if (ability.condition.battleType && ability.condition.battleType !== context.battleType) {
      return { triggered: false, ability: null };
    }
    if (ability.condition.hpRatio) {
      const hp = context.hpRatio ?? 1;
      if (ability.condition.hpRatio.min !== undefined && hp < ability.condition.hpRatio.min) {
        return { triggered: false, ability: null };
      }
      if (ability.condition.hpRatio.max !== undefined && hp > ability.condition.hpRatio.max) {
        return { triggered: false, ability: null };
      }
    }
    if (ability.condition.atmosRatio) {
      const atmos = context.atmosRatio ?? 1;
      if (ability.condition.atmosRatio.min !== undefined && atmos < ability.condition.atmosRatio.min) {
        return { triggered: false, ability: null };
      }
      if (ability.condition.atmosRatio.max !== undefined && atmos > ability.condition.atmosRatio.max) {
        return { triggered: false, ability: null };
      }
    }
  }

  // 발동 확률 체크
  if (rng.nextBool(ability.triggerChance)) {
    return { triggered: true, ability };
  }

  return { triggered: false, ability: null };
}

/**
 * 모든 특수 능력 발동 체크
 */
export function checkAllSpecialAbilities(
  armType: number,
  context: {
    phase?: 'approach' | 'combat' | 'retreat';
    battleType?: BattleType;
    hpRatio?: number;
    atmosRatio?: number;
  },
  rng: { nextBool: (chance: number) => boolean }
): CrewSpecialAbility[] {
  const traits = CREW_COMBAT_TRAITS[armType];
  if (!traits) return [];

  const triggeredAbilities: CrewSpecialAbility[] = [];

  for (const ability of traits.specialAbilities) {
    const result = checkSpecialAbility(armType, ability.id, context, rng);
    if (result.triggered && result.ability) {
      triggeredAbilities.push(result.ability);
    }
  }

  return triggeredAbilities;
}

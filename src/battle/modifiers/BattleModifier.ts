/**
 * 전투 보정 시스템
 * 지형, 날씨, 사기, 보급 등에 따른 전투력 보정
 */

import { WarUnitState } from '../engines/BaseBattleEngine';
import { BattleContext, BattleType, TerrainType, WeatherType } from '../engines/BattleType';
import { getCrewCombatTraits } from '../crews/CrewTypeCombat';

/**
 * 보정 타입
 */
export enum ModifierType {
  TERRAIN = 'terrain',
  WEATHER = 'weather',
  MORALE = 'morale',
  SUPPLY = 'supply',
  TRAINING = 'training',
  INJURY = 'injury',
  FATIGUE = 'fatigue',
  SIEGE = 'siege',
  DEFENSE = 'defense',
  GENERAL_SKILL = 'general_skill',
  NATION_BONUS = 'nation_bonus',
  SPECIAL_EFFECT = 'special_effect'
}

/**
 * 보정 결과
 */
export interface ModifierResult {
  type: ModifierType;
  name: string;
  value: number;
  description?: string;
}

/**
 * 총합 보정 결과
 */
export interface TotalModifierResult {
  attackMultiplier: number;
  defenseMultiplier: number;
  speedMultiplier: number;
  moraleMultiplier: number;
  modifiers: ModifierResult[];
}

/**
 * 지형 보정 계산
 */
export function calculateTerrainModifier(
  unit: WarUnitState,
  terrain: TerrainType,
  isAttacker: boolean
): ModifierResult {
  const traits = getCrewCombatTraits(unit.unit.armType);
  const baseModifier = traits?.terrainModifiers[terrain] ?? 1.0;

  // 공격/방어에 따른 추가 보정
  let adjustedModifier = baseModifier;

  // 성벽에서 방어 시 추가 보너스
  if (!isAttacker && (terrain === TerrainType.WALL || terrain === TerrainType.INNER_CASTLE)) {
    adjustedModifier *= 1.2;
  }

  // 평지에서 공격 시 기병 보너스
  if (isAttacker && terrain === TerrainType.PLAIN && unit.unit.armType === 3) {
    adjustedModifier *= 1.1;
  }

  const terrainNames: Record<TerrainType, string> = {
    [TerrainType.PLAIN]: '평지',
    [TerrainType.MOUNTAIN]: '산지',
    [TerrainType.WATER]: '수상',
    [TerrainType.WALL]: '성벽',
    [TerrainType.GATE]: '성문',
    [TerrainType.INNER_CASTLE]: '내성'
  };

  return {
    type: ModifierType.TERRAIN,
    name: `${terrainNames[terrain]} 지형`,
    value: adjustedModifier,
    description: adjustedModifier > 1 ? '유리' : adjustedModifier < 1 ? '불리' : '보통'
  };
}

/**
 * 날씨 보정 계산
 */
export function calculateWeatherModifier(
  unit: WarUnitState,
  weather: WeatherType
): ModifierResult {
  const traits = getCrewCombatTraits(unit.unit.armType);
  const baseModifier = traits?.weatherModifiers[weather] ?? 1.0;

  const weatherNames: Record<WeatherType, string> = {
    [WeatherType.CLEAR]: '맑음',
    [WeatherType.RAIN]: '비',
    [WeatherType.SNOW]: '눈',
    [WeatherType.FOG]: '안개',
    [WeatherType.WIND]: '바람'
  };

  return {
    type: ModifierType.WEATHER,
    name: `${weatherNames[weather]} 날씨`,
    value: baseModifier,
    description: baseModifier > 1 ? '유리' : baseModifier < 1 ? '불리' : '영향 없음'
  };
}

/**
 * 사기 보정 계산
 */
export function calculateMoraleModifier(unit: WarUnitState): ModifierResult {
  // 사기 40-130 범위
  const atmos = Math.max(40, Math.min(130, unit.atmos));

  // 100을 기준으로 보정
  // 40: 0.7, 70: 0.85, 100: 1.0, 130: 1.15
  const modifier = 0.4 + (atmos / 150);

  let description: string;
  if (atmos >= 110) {
    description = '사기충천';
  } else if (atmos >= 90) {
    description = '보통';
  } else if (atmos >= 60) {
    description = '저하';
  } else {
    description = '붕괴 직전';
  }

  return {
    type: ModifierType.MORALE,
    name: '사기',
    value: modifier,
    description
  };
}

/**
 * 보급 보정 계산
 */
export function calculateSupplyModifier(unit: WarUnitState): ModifierResult {
  // 군량이 HP 대비 얼마나 있는지 확인
  const riceRatio = unit.rice / Math.max(1, unit.hp);

  let modifier: number;
  let description: string;

  if (riceRatio >= 1.0) {
    modifier = 1.0;
    description = '충분';
  } else if (riceRatio >= 0.5) {
    modifier = 0.95;
    description = '보통';
  } else if (riceRatio >= 0.2) {
    modifier = 0.85;
    description = '부족';
  } else if (riceRatio > 0) {
    modifier = 0.7;
    description = '고갈 직전';
  } else {
    modifier = 0.5;
    description = '기아 상태';
  }

  return {
    type: ModifierType.SUPPLY,
    name: '보급',
    value: modifier,
    description
  };
}

/**
 * 훈련도 보정 계산
 */
export function calculateTrainingModifier(unit: WarUnitState): ModifierResult {
  // 훈련도 40-130 범위
  const train = Math.max(40, Math.min(130, unit.train));

  // 70을 기준 (기본값)으로 보정
  // 40: 0.8, 70: 1.0, 100: 1.15, 130: 1.3
  const modifier = 0.5 + (train / 140);

  let description: string;
  if (train >= 110) {
    description = '정예';
  } else if (train >= 80) {
    description = '숙련';
  } else if (train >= 50) {
    description = '일반';
  } else {
    description = '미숙';
  }

  return {
    type: ModifierType.TRAINING,
    name: '훈련도',
    value: modifier,
    description
  };
}

/**
 * 부상 보정 계산
 */
export function calculateInjuryModifier(unit: WarUnitState): ModifierResult {
  const injury = unit.stats.injury ?? 0;

  // 부상 0-80 범위
  // 0: 1.0, 40: 0.85, 80: 0.7
  const modifier = 1 - Math.min(injury, 80) / 250;

  let description: string;
  if (injury === 0) {
    description = '건강';
  } else if (injury <= 20) {
    description = '경상';
  } else if (injury <= 50) {
    description = '중상';
  } else {
    description = '치명상';
  }

  return {
    type: ModifierType.INJURY,
    name: '장수 부상',
    value: modifier,
    description
  };
}

/**
 * 피로도 보정 계산
 */
export function calculateFatigueModifier(unit: WarUnitState, turn: number): ModifierResult {
  // 전투 지속 턴에 따른 피로
  const fatigueTurns = turn;

  // 10턴까지는 영향 없음, 그 이후 턴당 2% 감소
  let modifier = 1.0;
  if (fatigueTurns > 10) {
    modifier = Math.max(0.7, 1 - (fatigueTurns - 10) * 0.02);
  }

  let description: string;
  if (fatigueTurns <= 10) {
    description = '양호';
  } else if (fatigueTurns <= 20) {
    description = '피로 누적';
  } else {
    description = '극심한 피로';
  }

  return {
    type: ModifierType.FATIGUE,
    name: '피로도',
    value: modifier,
    description
  };
}

/**
 * 공성전 보정 계산
 */
export function calculateSiegeModifier(
  unit: WarUnitState,
  isAttacker: boolean
): ModifierResult {
  const traits = getCrewCombatTraits(unit.unit.armType);

  let modifier: number;
  let description: string;

  if (isAttacker) {
    modifier = 1.0 + (traits?.siegeAttackBonus ?? 0);
    description = modifier > 1 ? '공성 유리' : modifier < 1 ? '공성 불리' : '보통';
  } else {
    modifier = 1.0 + (traits?.siegeDefenseBonus ?? 0);
    description = modifier > 1 ? '수성 유리' : modifier < 1 ? '수성 불리' : '보통';
  }

  return {
    type: ModifierType.SIEGE,
    name: isAttacker ? '공성' : '수성',
    value: modifier,
    description
  };
}

/**
 * 장수 스킬 보정 계산
 */
export function calculateGeneralSkillModifier(unit: WarUnitState): ModifierResult {
  const skills = unit.stats.specialSkills ?? [];
  const inheritBuff = unit.stats.inheritBuff;

  let modifier = 1.0;
  const bonusDescriptions: string[] = [];

  // 전투 관련 스킬 보너스
  if (skills.includes('돌격')) {
    modifier += 0.05;
    bonusDescriptions.push('돌격');
  }
  if (skills.includes('집중')) {
    modifier += 0.03;
    bonusDescriptions.push('집중');
  }
  if (skills.includes('위압')) {
    modifier += 0.02;
    bonusDescriptions.push('위압');
  }

  // 상속 버프
  if (inheritBuff) {
    if (inheritBuff.warCriticalRatio) {
      modifier += inheritBuff.warCriticalRatio / 200;
    }
    if (inheritBuff.warAvoidRatio) {
      modifier += inheritBuff.warAvoidRatio / 200;
    }
  }

  return {
    type: ModifierType.GENERAL_SKILL,
    name: '장수 스킬',
    value: modifier,
    description: bonusDescriptions.length > 0 ? bonusDescriptions.join(', ') : '없음'
  };
}

/**
 * 국가 보너스 보정 계산
 */
export function calculateNationBonusModifier(
  unit: WarUnitState,
  nationBonuses?: Record<string, number>
): ModifierResult {
  let modifier = 1.0;
  const bonusDescriptions: string[] = [];

  if (nationBonuses) {
    if (nationBonuses.warAttack) {
      modifier += nationBonuses.warAttack / 100;
      bonusDescriptions.push(`공격력 +${nationBonuses.warAttack}%`);
    }
    if (nationBonuses.warDefense) {
      modifier += nationBonuses.warDefense / 100;
      bonusDescriptions.push(`방어력 +${nationBonuses.warDefense}%`);
    }
  }

  return {
    type: ModifierType.NATION_BONUS,
    name: '국가 보너스',
    value: modifier,
    description: bonusDescriptions.length > 0 ? bonusDescriptions.join(', ') : '없음'
  };
}

/**
 * 모든 보정 계산 및 합산
 */
export function calculateTotalModifiers(
  unit: WarUnitState,
  context: BattleContext,
  isAttacker: boolean,
  turn: number,
  nationBonuses?: Record<string, number>
): TotalModifierResult {
  const modifiers: ModifierResult[] = [];

  // 각 보정 계산
  modifiers.push(calculateTerrainModifier(unit, context.terrain, isAttacker));
  modifiers.push(calculateWeatherModifier(unit, context.weather));
  modifiers.push(calculateMoraleModifier(unit));
  modifiers.push(calculateSupplyModifier(unit));
  modifiers.push(calculateTrainingModifier(unit));
  modifiers.push(calculateInjuryModifier(unit));
  modifiers.push(calculateFatigueModifier(unit, turn));
  modifiers.push(calculateGeneralSkillModifier(unit));
  modifiers.push(calculateNationBonusModifier(unit, nationBonuses));

  // 공성전/수비전 보정
  if (context.battleType === BattleType.SIEGE || context.battleType === BattleType.DEFENSE) {
    modifiers.push(calculateSiegeModifier(unit, isAttacker));
  }

  // 공격력 총합 (모든 modifier 곱셈)
  let attackMultiplier = 1.0;
  let defenseMultiplier = 1.0;
  let speedMultiplier = 1.0;
  let moraleMultiplier = 1.0;

  for (const mod of modifiers) {
    switch (mod.type) {
      case ModifierType.TERRAIN:
      case ModifierType.WEATHER:
      case ModifierType.SIEGE:
      case ModifierType.DEFENSE:
        // 공격/방어 모두에 영향
        attackMultiplier *= mod.value;
        defenseMultiplier *= mod.value;
        break;

      case ModifierType.MORALE:
        // 공격력과 사기에 영향
        attackMultiplier *= mod.value;
        moraleMultiplier *= mod.value;
        break;

      case ModifierType.SUPPLY:
      case ModifierType.FATIGUE:
        // 모든 능력에 영향
        attackMultiplier *= mod.value;
        defenseMultiplier *= mod.value;
        speedMultiplier *= mod.value;
        break;

      case ModifierType.TRAINING:
        // 방어력과 사기에 영향
        defenseMultiplier *= mod.value;
        moraleMultiplier *= mod.value;
        break;

      case ModifierType.INJURY:
        // 모든 능력에 영향
        attackMultiplier *= mod.value;
        defenseMultiplier *= mod.value;
        speedMultiplier *= mod.value;
        break;

      case ModifierType.GENERAL_SKILL:
      case ModifierType.NATION_BONUS:
        // 공격력에 주로 영향
        attackMultiplier *= mod.value;
        break;
    }
  }

  return {
    attackMultiplier,
    defenseMultiplier,
    speedMultiplier,
    moraleMultiplier,
    modifiers
  };
}

/**
 * 보정 요약 문자열 생성
 */
export function getModifierSummary(result: TotalModifierResult): string[] {
  const lines: string[] = [];

  // 주요 보정만 표시
  const significantModifiers = result.modifiers.filter(m =>
    m.value < 0.95 || m.value > 1.05
  );

  for (const mod of significantModifiers) {
    const percentage = Math.round((mod.value - 1) * 100);
    const sign = percentage >= 0 ? '+' : '';
    lines.push(`${mod.name}: ${sign}${percentage}% (${mod.description})`);
  }

  return lines;
}

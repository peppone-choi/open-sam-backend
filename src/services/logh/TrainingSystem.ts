/**
 * TrainingSystem - 사관학교 및 훈련 시스템
 *
 * 숙련도 레벨 체계:
 * - Green (신병): 0-29점 - 전투력 -10%
 * - Normal (일반): 30-69점 - 기본 전투력
 * - Veteran (숙련): 70-99점 - 전투력 +10%
 * - Elite (정예): 100점 - 전투력 +20%
 */

import { IFleet } from '../../models/logh/Fleet.model';

// 숙련도 레벨 정의
export type ExperienceLevel = 'green' | 'normal' | 'veteran' | 'elite';

// 숙련도 레벨 임계값
export const EXPERIENCE_THRESHOLDS = {
  green: { min: 0, max: 29 },
  normal: { min: 30, max: 69 },
  veteran: { min: 70, max: 99 },
  elite: { min: 100, max: 100 },
} as const;

// 숙련도 레벨별 전투 보정치
export const EXPERIENCE_COMBAT_MODIFIERS = {
  green: 0.9, // -10%
  normal: 1.0, // 기본
  veteran: 1.1, // +10%
  elite: 1.2, // +20%
} as const;

// 숙련도 레벨별 사기 보정치
export const EXPERIENCE_MORALE_MODIFIERS = {
  green: -5,
  normal: 0,
  veteran: +5,
  elite: +10,
} as const;

// 숙련도 레벨 한글명
export const EXPERIENCE_LEVEL_NAMES: Record<ExperienceLevel, string> = {
  green: '신병',
  normal: '일반',
  veteran: '숙련',
  elite: '정예',
};

// 수강 가능 스탯 목록
export const STUDY_STATS = [
  'leadership', // 통솔력
  'politics', // 정치력
  'operations', // 운영/분석력
  'intelligence', // 지략
  'command', // 지휘력
  'maneuver', // 기동력
  'attack', // 공격력
  'defense', // 방어력
] as const;

export type StudyStat = (typeof STUDY_STATS)[number];

// 스탯 한글명
export const STAT_NAMES: Record<StudyStat, string> = {
  leadership: '통솔력',
  politics: '정치력',
  operations: '운영력',
  intelligence: '지략',
  command: '지휘력',
  maneuver: '기동력',
  attack: '공격력',
  defense: '방어력',
};

// 전술 스킬 목록 (병기 연습으로 획득 가능)
export const TACTICAL_SKILLS = [
  'flank_attack', // 측면 공격
  'pincer_movement', // 협공
  'feigned_retreat', // 위장 퇴각
  'concentrated_fire', // 집중 사격
  'defensive_formation', // 방어 진형
  'rapid_advance', // 급속 전진
  'ambush', // 매복
  'encirclement', // 포위
] as const;

export type TacticalSkill = (typeof TACTICAL_SKILLS)[number];

// 전술 스킬 한글명
export const TACTICAL_SKILL_NAMES: Record<TacticalSkill, string> = {
  flank_attack: '측면 공격',
  pincer_movement: '협공',
  feigned_retreat: '위장 퇴각',
  concentrated_fire: '집중 사격',
  defensive_formation: '방어 진형',
  rapid_advance: '급속 전진',
  ambush: '매복',
  encirclement: '포위',
};

/**
 * 경험치를 기반으로 숙련도 레벨 계산
 */
export function calculateExperienceLevel(experiencePoints: number): ExperienceLevel {
  if (experiencePoints >= EXPERIENCE_THRESHOLDS.elite.min) {
    return 'elite';
  } else if (experiencePoints >= EXPERIENCE_THRESHOLDS.veteran.min) {
    return 'veteran';
  } else if (experiencePoints >= EXPERIENCE_THRESHOLDS.normal.min) {
    return 'normal';
  }
  return 'green';
}

/**
 * 훈련도 평균으로 경험치 계산
 * 훈련도 평균이 높을수록 경험치도 높아짐
 */
export function calculateExperienceFromTraining(training: {
  discipline: number;
  space: number;
  ground: number;
  air: number;
}): number {
  const average = (training.discipline + training.space + training.ground + training.air) / 4;
  return Math.floor(average);
}

/**
 * 함대의 숙련도 레벨 업데이트
 */
export function updateFleetExperience(fleet: IFleet): {
  oldLevel: ExperienceLevel;
  newLevel: ExperienceLevel;
  levelChanged: boolean;
} {
  const oldLevel = fleet.experienceLevel;

  // 훈련도 기반 경험치 계산
  const trainingExp = calculateExperienceFromTraining(fleet.training);

  // 기존 경험치와 비교하여 높은 값 사용 (경험치는 하락하지 않음)
  fleet.experiencePoints = Math.max(fleet.experiencePoints, trainingExp);

  // 새 레벨 계산
  const newLevel = calculateExperienceLevel(fleet.experiencePoints);
  fleet.experienceLevel = newLevel;

  return {
    oldLevel,
    newLevel,
    levelChanged: oldLevel !== newLevel,
  };
}

/**
 * 전투 보정치 계산
 */
export function getCombatModifier(experienceLevel: ExperienceLevel): number {
  return EXPERIENCE_COMBAT_MODIFIERS[experienceLevel];
}

/**
 * 사기 보정치 계산
 */
export function getMoraleModifier(experienceLevel: ExperienceLevel): number {
  return EXPERIENCE_MORALE_MODIFIERS[experienceLevel];
}

/**
 * 수강 시 능력치 증가량 계산
 * @param currentValue 현재 스탯 값
 * @param hasInstructor 강의 중인 교관 존재 여부
 * @param instructorSkill 교관 능력치 (해당 스탯)
 */
export function calculateStudyIncrease(
  currentValue: number,
  hasInstructor: boolean = false,
  instructorSkill: number = 0
): number {
  // 기본 증가량: 1~3
  let baseIncrease = Math.floor(Math.random() * 3) + 1;

  // 교관 보너스: 교관 능력치에 따라 0~2 추가
  if (hasInstructor && instructorSkill > 0) {
    const instructorBonus = Math.floor(instructorSkill / 50); // 50당 +1, 최대 +2
    baseIncrease += instructorBonus;
  }

  // 현재 값이 높을수록 증가량 감소 (성장 둔화)
  if (currentValue >= 90) {
    baseIncrease = Math.ceil(baseIncrease * 0.3); // 90 이상이면 30%만
  } else if (currentValue >= 70) {
    baseIncrease = Math.ceil(baseIncrease * 0.6); // 70-89면 60%만
  } else if (currentValue >= 50) {
    baseIncrease = Math.ceil(baseIncrease * 0.8); // 50-69면 80%만
  }

  return Math.max(1, baseIncrease); // 최소 1
}

/**
 * 병기 연습 성공 여부 계산
 * @param commanderStats 커맨더 스탯
 */
export function calculateWargameSuccess(commanderStats: {
  command: number;
  intelligence: number;
  maneuver: number;
}): { success: boolean; score: number } {
  // 기본 성공률: 50%
  const baseRate = 50;

  // 스탯 보너스: 지휘력 + 지략 + 기동력 평균의 절반
  const statAverage = (commanderStats.command + commanderStats.intelligence + commanderStats.maneuver) / 3;
  const statBonus = statAverage / 2;

  const successRate = Math.min(95, baseRate + statBonus); // 최대 95%
  const roll = Math.random() * 100;
  const success = roll < successRate;

  // 점수 계산 (성공 시 50-100, 실패 시 0-49)
  const score = success ? Math.floor(Math.random() * 51) + 50 : Math.floor(Math.random() * 50);

  return { success, score };
}

/**
 * 랜덤 전술 스킬 선택
 * @param excludeSkills 제외할 스킬 목록 (이미 보유 중인 스킬)
 */
export function selectRandomTacticalSkill(excludeSkills: string[] = []): TacticalSkill | null {
  const availableSkills = TACTICAL_SKILLS.filter((skill) => !excludeSkills.includes(skill));

  if (availableSkills.length === 0) {
    return null; // 모든 스킬 보유
  }

  const randomIndex = Math.floor(Math.random() * availableSkills.length);
  return availableSkills[randomIndex];
}

/**
 * 강의 시 명성 획득량 계산
 * @param instructorRank 교관 계급 (1=원수, 2=상급대장, ...)
 * @param instructorFame 교관 현재 명성
 */
export function calculateLectureFameGain(instructorRank: number, instructorFame: number): number {
  // 고위 계급일수록 기본 명성 획득량 증가
  const rankBonus = Math.max(0, 10 - instructorRank); // 원수(1)이면 +9, 대위(10)이면 0

  // 기본 획득량: 5~15
  const baseFame = Math.floor(Math.random() * 11) + 5;

  // 현재 명성이 높으면 추가 획득 감소 (명성은 얻기 힘들어짐)
  const fameMultiplier = Math.max(0.3, 1 - instructorFame / 1000);

  return Math.floor((baseFame + rankBonus) * fameMultiplier);
}

/**
 * 훈련도 증가량 계산
 * @param trainingType 훈련 유형
 * @param commanderStats 커맨더 스탯
 */
export function calculateTrainingIncrease(
  trainingType: 'space' | 'ground' | 'air',
  commanderStats: { command: number; leadership: number }
): number {
  // 기본 증가량: 5~10
  const baseIncrease = Math.floor(Math.random() * 6) + 5;

  // 지휘력 + 통솔력 보너스: 평균 80 이상이면 +2, 60 이상이면 +1
  const statAverage = (commanderStats.command + commanderStats.leadership) / 2;
  let bonus = 0;
  if (statAverage >= 80) {
    bonus = 2;
  } else if (statAverage >= 60) {
    bonus = 1;
  }

  return baseIncrease + bonus;
}

/**
 * 전투 후 경험치 획득량 계산
 * @param isVictory 승리 여부
 * @param enemyStrength 적 전력 비율 (0-1)
 */
export function calculateBattleExperience(isVictory: boolean, enemyStrength: number): number {
  // 승리 시 기본 5점, 패배 시 2점
  let baseExp = isVictory ? 5 : 2;

  // 적 전력이 강할수록 경험치 증가
  const strengthBonus = Math.floor(enemyStrength * 5);

  return baseExp + strengthBonus;
}















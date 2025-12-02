/**
 * 명마 효과 정의 및 유틸리티
 * PHP 참조: core/hwe/sammo/WarUnitTrigger/che_퇴각부상무효.php 등
 */

import { WarUnit, WarUnitTrigger, WarUnitTriggerType, General, StatType } from './types';

/**
 * 특수 효과 ID 상수
 */
export const MountSpecialEffects = {
  /** 퇴각 부상 무효 (백마, 사륜거) */
  NO_RETREAT_INJURY: 'no_retreat_injury',
  /** 공격 페이즈 +1 (기주마) */
  PHASE_PLUS_ONE: 'phase_plus_one',
  /** 공격 페이즈 -1, 공격력 +20%, 군량 +10% (백상) */
  ELEPHANT_CHARGE: 'elephant_charge',
  /** 병력 비례 회피 증가 (옥란백용구) */
  LOW_HP_EVASION: 'low_hp_evasion',
} as const;

export type MountSpecialEffectId = typeof MountSpecialEffects[keyof typeof MountSpecialEffects];

/**
 * 퇴각 부상 무효 트리거
 */
export class NoRetreatInjuryTrigger implements WarUnitTrigger {
  type = WarUnitTriggerType.ITEM;
  unit: WarUnit;

  constructor(unit: WarUnit) {
    this.unit = unit;
  }

  apply(): void {
    // 전투 종료 시 부상 판정 무효화
    // 실제 구현은 전투 시스템과 연동 필요
  }
}

/**
 * 스탯 계산 헬퍼 함수들
 */
export const MountStatCalculators = {
  /**
   * 공격 페이즈 +1 계산
   */
  phasePlusOne(statName: StatType, value: number): number {
    if (statName === 'initWarPhase') {
      return value + 1;
    }
    return value;
  },

  /**
   * 공격 페이즈 -1 계산
   */
  phaseMinusOne(statName: StatType, value: number): number {
    if (statName === 'initWarPhase') {
      return value - 1;
    }
    return value;
  },

  /**
   * 군량 소모 증가 (백상)
   */
  killRiceMultiplier(statName: StatType, value: number, multiplier: number): number {
    if (statName === 'killRice') {
      return value * multiplier;
    }
    return value;
  },

  /**
   * 병력 비례 회피 확률 계산 (옥란백용구)
   * @param general 장수 객체
   * @param value 기본 회피 확률
   * @param maxBonus 최대 보너스 (0.5 = 50%)
   */
  lowHpEvasionBonus(
    general: General,
    statName: StatType,
    value: number,
    maxBonus: number = 0.5
  ): number {
    if (statName === 'warAvoidRatio') {
      const leadership = general.getLeadership(true, true, true, false);
      const crewRatio = general.getVar('crew') / 100;
      const bonus = Math.max(0, Math.min((1 - crewRatio / leadership) * maxBonus, maxBonus));
      return value + bonus;
    }
    return value;
  },
};

/**
 * 전투력 배율 헬퍼
 */
export const MountWarPowerMultipliers = {
  /**
   * 백상 전투력 배율 (공격 +20%)
   */
  elephantPower(): [number, number] {
    return [1.2, 1];
  },

  /**
   * 기본값 (변경 없음)
   */
  default(): [number, number] {
    return [1, 1];
  },
};

/**
 * 값 범위 제한 유틸리티 (PHP Util::valueFit 대응)
 */
export function valueFit(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/**
 * 효과 설명 템플릿
 */
export const EffectDescriptions = {
  [MountSpecialEffects.NO_RETREAT_INJURY]: '[전투] 전투 종료로 인한 부상 없음',
  [MountSpecialEffects.PHASE_PLUS_ONE]: '[전투] 공격 시 페이즈 +1',
  [MountSpecialEffects.ELEPHANT_CHARGE]: '[전투] 공격력 +20%, 소모 군량 +10%, 공격 시 페이즈 -1',
  [MountSpecialEffects.LOW_HP_EVASION]: '[전투] 남은 병력이 적을수록 회피 확률 증가. 최대 +50%p',
} as const;



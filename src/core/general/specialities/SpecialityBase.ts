/**
 * 장수 특기 시스템 - 기본 클래스
 * PHP core/hwe/sammo/BaseSpecial.php 기반
 */

import { BattleUnit } from '../../battle/interfaces/Unit';
import { IAttackResult } from '../../battle/interfaces/Battle';

// ============================================================================
// 특기 타입 및 상수
// ============================================================================

/**
 * 특기 카테고리
 */
export enum SpecialityCategory {
  BATTLE = 'battle',       // 전투 특기
  TACTICS = 'tactics',     // 계략 특기
  POLITICS = 'politics',   // 내정 특기
  UNIT = 'unit',           // 병종 특기
  SPECIAL = 'special',     // 특수 특기
}

/**
 * 스탯 요구 조건 (PHP SpecialityHelper 참조)
 */
export enum StatRequirement {
  NONE = 0x0,
  DISABLED = 0x1,
  STAT_LEADERSHIP = 0x2,
  STAT_STRENGTH = 0x4,
  STAT_INTEL = 0x8,
  ARMY_FOOTMAN = 0x100,
  ARMY_ARCHER = 0x200,
  ARMY_CAVALRY = 0x400,
  ARMY_WIZARD = 0x800,
  ARMY_SIEGE = 0x1000,
  REQ_DEXTERITY = 0x4000,
  STAT_NOT_LEADERSHIP = 0x20000,
  STAT_NOT_STRENGTH = 0x40000,
  STAT_NOT_INTEL = 0x80000,
}

/**
 * 선택 가중치 타입
 */
export enum SelectWeightType {
  NORM = 1,      // 일반 가중치
  PERCENT = 2,   // 퍼센트 가중치
}

/**
 * 트리거 타이밍
 */
export enum TriggerTiming {
  BATTLE_START = 'battle_start',
  TURN_START = 'turn_start',
  BEFORE_ATTACK = 'before_attack',
  ON_ATTACK = 'on_attack',
  AFTER_ATTACK = 'after_attack',
  BEFORE_DEFEND = 'before_defend',
  ON_DEFEND = 'on_defend',
  AFTER_DEFEND = 'after_defend',
  BEFORE_SKILL = 'before_skill',
  ON_SKILL = 'on_skill',
  AFTER_SKILL = 'after_skill',
  TURN_END = 'turn_end',
  BATTLE_END = 'battle_end',
}

// ============================================================================
// 컨텍스트 인터페이스
// ============================================================================

/**
 * 전투 컨텍스트 (Agent C BattleContext 참조)
 */
export interface IBattleContext {
  battleId: string;
  currentTurn: number;
  phase: string;
  attacker: BattleUnit;
  defender: BattleUnit;
  isPlayerAttacker: boolean;
}

/**
 * 스탯 계산 컨텍스트
 */
export interface IStatCalcContext {
  statName: string;
  baseValue: number;
  unit: BattleUnit;
  isAttacker?: boolean;
  opponent?: BattleUnit;
  skillId?: string;
}

/**
 * 내정 계산 컨텍스트
 */
export interface IDomesticCalcContext {
  turnType: string;    // '농업', '상업', '민심', '인구', '계략' 등
  varType: string;     // 'score', 'cost', 'success'
  baseValue: number;
  cityId?: string;
}

/**
 * 전투력 배수 결과
 */
export interface IWarPowerMultiplier {
  attackMultiplier: number;
  defenseMultiplier: number;
}

/**
 * 트리거 결과
 */
export interface ITriggerResult {
  activated: boolean;
  message?: string;
  effects?: Record<string, number>;
  preventDefault?: boolean;
}

// ============================================================================
// 특기 기본 클래스
// ============================================================================

/**
 * 특기 기본 클래스
 * 모든 특기는 이 클래스를 상속
 */
export abstract class SpecialityBase {
  /** 특기 고유 ID */
  abstract readonly id: number;

  /** 특기 이름 */
  abstract readonly name: string;

  /** 특기 설명 */
  abstract readonly info: string;

  /** 특기 카테고리 */
  abstract readonly category: SpecialityCategory;

  /** 선택 가중치 타입 */
  static selectWeightType: SelectWeightType = SelectWeightType.NORM;

  /** 선택 가중치 */
  static selectWeight: number = 1;

  /** 요구 조건 타입 배열 */
  static requirements: StatRequirement[] = [];

  // ==========================================================================
  // 스탯 계산 훅
  // ==========================================================================

  /**
   * 스탯 계산 시 호출 (자신의 스탯)
   * @param ctx 스탯 계산 컨텍스트
   * @returns 수정된 값
   */
  onCalcStat(ctx: IStatCalcContext): number {
    return ctx.baseValue;
  }

  /**
   * 상대 스탯 계산 시 호출 (디버프 등)
   * @param ctx 스탯 계산 컨텍스트
   * @returns 수정된 값
   */
  onCalcOpposeStat(ctx: IStatCalcContext): number {
    return ctx.baseValue;
  }

  /**
   * 내정 계산 시 호출
   * @param ctx 내정 계산 컨텍스트
   * @returns 수정된 값
   */
  onCalcDomestic(ctx: IDomesticCalcContext): number {
    return ctx.baseValue;
  }

  // ==========================================================================
  // 전투 전용 훅
  // ==========================================================================

  /**
   * 전투력 배수 반환
   * @param unit 유닛 정보
   * @param opponent 상대 유닛
   * @returns [공격배수, 방어배수]
   */
  getWarPowerMultiplier(
    unit: BattleUnit,
    opponent?: BattleUnit
  ): IWarPowerMultiplier {
    return { attackMultiplier: 1, defenseMultiplier: 1 };
  }

  /**
   * 크리티컬 확률 보정
   * @param baseRate 기본 확률
   * @param isAttacker 공격자 여부
   * @returns 수정된 확률
   */
  getCriticalRateBonus(baseRate: number, isAttacker: boolean): number {
    return baseRate;
  }

  /**
   * 회피 확률 보정
   * @param baseRate 기본 확률
   * @returns 수정된 확률
   */
  getEvasionRateBonus(baseRate: number): number {
    return baseRate;
  }

  // ==========================================================================
  // 트리거 시스템
  // ==========================================================================

  /**
   * 특정 타이밍에 트리거되는 효과
   * @param timing 트리거 타이밍
   * @param ctx 전투 컨텍스트
   * @returns 트리거 결과
   */
  onTrigger(timing: TriggerTiming, ctx: IBattleContext): ITriggerResult {
    return { activated: false };
  }

  /**
   * 해당 트리거 타이밍을 지원하는지 확인
   * @param timing 트리거 타이밍
   */
  supportsTrigger(timing: TriggerTiming): boolean {
    return false;
  }

  /**
   * 지원하는 트리거 타이밍 목록
   */
  getSupportedTriggers(): TriggerTiming[] {
    return [];
  }

  // ==========================================================================
  // 유틸리티
  // ==========================================================================

  /**
   * 특기 활성화 조건 확인
   * @param unit 유닛 정보
   */
  canActivate(unit: BattleUnit): boolean {
    return true;
  }

  /**
   * 특기 정보를 JSON으로 반환
   */
  toJSON(): object {
    return {
      id: this.id,
      name: this.name,
      info: this.info,
      category: this.category,
    };
  }

  /**
   * 디버그용 문자열
   */
  toString(): string {
    return `[${this.category}] ${this.name}: ${this.info}`;
  }
}

// ============================================================================
// 전투 특기 베이스
// ============================================================================

/**
 * 전투 특기 베이스 클래스
 */
export abstract class BattleSpecialityBase extends SpecialityBase {
  readonly category = SpecialityCategory.BATTLE;

  /**
   * 선제 공격 확률 보정
   */
  getInitiativeBonus(baseValue: number): number {
    return baseValue;
  }

  /**
   * 추가 페이즈 수
   */
  getExtraPhases(): number {
    return 0;
  }

  /**
   * 전투 시작 시 사기 보정
   */
  getInitialMoraleBonus(): number {
    return 0;
  }
}

// ============================================================================
// 계략 특기 베이스
// ============================================================================

/**
 * 계략 특기 베이스 클래스
 */
export abstract class TacticsSpecialityBase extends SpecialityBase {
  readonly category = SpecialityCategory.TACTICS;

  /**
   * 계략 성공 확률 보정
   */
  getTacticsSuccessBonus(baseRate: number): number {
    return baseRate;
  }

  /**
   * 계략 데미지 배수
   */
  getTacticsDamageMultiplier(): number {
    return 1;
  }

  /**
   * 반계 확률
   */
  getCounterTacticsChance(): number {
    return 0;
  }
}

// ============================================================================
// 내정 특기 베이스
// ============================================================================

/**
 * 내정 특기 베이스 클래스
 */
export abstract class PoliticsSpecialityBase extends SpecialityBase {
  readonly category = SpecialityCategory.POLITICS;

  /**
   * 내정 효율 보정
   * @param type 내정 타입
   * @returns 효율 배수
   */
  getDomesticEfficiency(type: string): number {
    return 1;
  }

  /**
   * 비용 감소율
   * @param type 내정 타입
   */
  getCostReduction(type: string): number {
    return 0;
  }
}

// ============================================================================
// 병종 특기 베이스
// ============================================================================

/**
 * 병종 특기 베이스 클래스
 */
export abstract class UnitSpecialityBase extends SpecialityBase {
  readonly category = SpecialityCategory.UNIT;

  /**
   * 해당 병종인지 확인
   * @param unitType 병종 타입
   */
  abstract matchesUnitType(unitType: string): boolean;

  /**
   * 병종 전투력 보정
   */
  getUnitPowerBonus(): IWarPowerMultiplier {
    return { attackMultiplier: 1, defenseMultiplier: 1 };
  }

  /**
   * 병종 이동력 보정
   */
  getUnitMobilityBonus(): number {
    return 0;
  }
}

// ============================================================================
// 타입 가드
// ============================================================================

export function isBattleSpeciality(
  spec: SpecialityBase
): spec is BattleSpecialityBase {
  return spec.category === SpecialityCategory.BATTLE;
}

export function isTacticsSpeciality(
  spec: SpecialityBase
): spec is TacticsSpecialityBase {
  return spec.category === SpecialityCategory.TACTICS;
}

export function isPoliticsSpeciality(
  spec: SpecialityBase
): spec is PoliticsSpecialityBase {
  return spec.category === SpecialityCategory.POLITICS;
}

export function isUnitSpeciality(
  spec: SpecialityBase
): spec is UnitSpecialityBase {
  return spec.category === SpecialityCategory.UNIT;
}



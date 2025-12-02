/**
 * 명마/탈것 관련 타입 정의
 */

/**
 * 명마 등급
 */
export type MountGrade = 'common' | 'advanced' | 'rare' | 'legendary';

/**
 * 스탯 타입
 */
export type StatType = 
  | 'leadership'      // 통솔
  | 'strength'        // 무력
  | 'intel'           // 지력
  | 'killRice'        // 소모 군량
  | 'initWarPhase'    // 초기 전투 페이즈
  | 'warAvoidRatio'   // 회피 확률
  | 'warCriticalRatio'// 크리티컬 확률
  | 'warCounterRatio' // 반격 확률
  | 'speed'           // 이동 속도
  | 'retreatProb';    // 퇴각 확률

/**
 * 명마 효과 인터페이스
 */
export interface MountEffect {
  /** 통솔 보너스 */
  leadership: number;
  /** 이동 속도 보너스 */
  speed: number;
  /** 퇴각 성공률 보너스 */
  retreat: number;
  /** 돌격 데미지 보너스 */
  charge: number;
  /** 방어력 보너스 */
  defense: number;
  /** 특수 효과 ID */
  special?: string;
}

/**
 * 전투 유닛 인터페이스 (간소화)
 */
export interface WarUnit {
  id: string;
  generalId: number;
  crew: number;
  leadership: number;
  strength: number;
  intel: number;
  phase: number;
}

/**
 * 장수 인터페이스 (간소화)
 */
export interface General {
  id: number;
  name: string;
  leadership: number;
  strength: number;
  intel: number;
  crew: number;
  getLeadership(base?: boolean, bonus?: boolean, item?: boolean, special?: boolean): number;
  getVar(name: string): number;
}

/**
 * 전투 트리거 타입
 */
export enum WarUnitTriggerType {
  ITEM = 'item',
  SKILL = 'skill',
  SPECIAL = 'special',
}

/**
 * 전투 트리거 인터페이스
 */
export interface WarUnitTrigger {
  type: WarUnitTriggerType;
  unit: WarUnit;
  apply(): void;
}

/**
 * 전투 트리거 호출자
 */
export class WarUnitTriggerCaller {
  private triggers: WarUnitTrigger[];

  constructor(...triggers: WarUnitTrigger[]) {
    this.triggers = triggers;
  }

  getTriggers(): WarUnitTrigger[] {
    return this.triggers;
  }

  applyAll(): void {
    for (const trigger of this.triggers) {
      trigger.apply();
    }
  }
}

/**
 * 명마 메타데이터
 */
export interface MountMetadata {
  code: string;
  rawName: string;
  statValue: number;
  grade: MountGrade;
  cost: number;
  buyable: boolean;
  reqSecu: number;
  info: string;
  hasSpecialEffect: boolean;
}

/**
 * 명마 정렬 옵션
 */
export interface MountSortOptions {
  by: 'grade' | 'cost' | 'statValue' | 'name';
  order: 'asc' | 'desc';
}

/**
 * 명마 필터 옵션
 */
export interface MountFilterOptions {
  grade?: MountGrade | MountGrade[];
  buyable?: boolean;
  minStatValue?: number;
  maxStatValue?: number;
  hasSpecialEffect?: boolean;
}



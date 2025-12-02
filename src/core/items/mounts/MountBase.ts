/**
 * 명마/탈것 기본 클래스
 * PHP 참조: core/hwe/sammo/BaseStatItem.php, BaseItem.php
 */

import { MountEffect, MountGrade, WarUnit, General, StatType, WarUnitTriggerCaller } from './types';

/**
 * 명마 기본 추상 클래스
 * 모든 명마는 이 클래스를 상속받아 구현
 */
export abstract class MountBase {
  /** 아이템 코드 (che_명마_XX_이름) */
  abstract readonly code: string;
  
  /** 원본 이름 (표시용) */
  abstract readonly rawName: string;
  
  /** 스탯 수치 (등급) */
  abstract readonly statValue: number;
  
  /** 구매 가격 */
  protected _cost: number = 200;
  
  /** 구매 가능 여부 */
  protected _buyable: boolean = false;
  
  /** 구매 요구 치안도 */
  protected _reqSecu: number = 0;
  
  /** 소모성 아이템 여부 */
  protected _consumable: boolean = false;
  
  /** 추가 정보 (특수 효과 설명) */
  protected _additionalInfo: string = '';

  /**
   * 표시 이름 (예: "적토마(+15)")
   */
  get name(): string {
    return `${this.rawName}(+${this.statValue})`;
  }

  /**
   * 아이템 정보 설명
   */
  get info(): string {
    const baseInfo = `통솔 +${this.statValue}`;
    return this._additionalInfo 
      ? `${baseInfo}\n${this._additionalInfo}` 
      : baseInfo;
  }

  /**
   * 구매 가격
   */
  get cost(): number {
    return this._cost;
  }

  /**
   * 구매 가능 여부
   */
  get buyable(): boolean {
    return this._buyable;
  }

  /**
   * 구매 요구 치안도
   */
  get reqSecu(): number {
    return this._reqSecu;
  }

  /**
   * 소모성 아이템 여부
   */
  get consumable(): boolean {
    return this._consumable;
  }

  /**
   * 등급 분류
   */
  get grade(): MountGrade {
    if (this.statValue <= 6) return 'common';
    if (this.statValue <= 9) return 'advanced';
    if (this.statValue <= 12) return 'rare';
    return 'legendary';
  }

  /**
   * 스탯 계산 훅
   * @param general 장수 객체
   * @param statName 스탯 이름
   * @param value 기본 값
   * @param aux 보조 데이터
   * @returns 계산된 스탯 값
   */
  onCalcStat(general: General, statName: StatType, value: number, aux?: unknown): number {
    // 기본: 통솔(leadership) 스탯 증가
    if (statName === 'leadership') {
      return value + this.statValue;
    }
    return value;
  }

  /**
   * 전투 시 공격력/방어력 배율
   * @param unit 전투 유닛
   * @returns [공격력 배율, 방어력 배율]
   */
  getWarPowerMultiplier(unit: WarUnit): [number, number] {
    return [1, 1]; // 기본값: 변경 없음
  }

  /**
   * 전투 초기화 시 스킬 트리거 목록
   * @param unit 전투 유닛
   * @returns 트리거 목록 또는 null
   */
  getBattleInitSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null {
    return null;
  }

  /**
   * 아이템 소모 시도 (소모성 아이템용)
   * @param general 장수 객체
   * @param actionType 행동 타입
   * @param command 명령
   * @returns 소모 성공 여부
   */
  tryConsumeNow(general: General, actionType: string, command: string): boolean {
    return false;
  }

  /**
   * 명마 효과 객체 반환
   */
  getEffect(): MountEffect {
    return {
      leadership: this.statValue,
      speed: 0,
      retreat: 0,
      charge: 0,
      defense: 0,
    };
  }

  /**
   * JSON 직렬화
   */
  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      name: this.name,
      rawName: this.rawName,
      statValue: this.statValue,
      grade: this.grade,
      cost: this.cost,
      buyable: this.buyable,
      reqSecu: this.reqSecu,
      consumable: this.consumable,
      info: this.info,
      effect: this.getEffect(),
    };
  }
}

/**
 * 기본 명마 클래스 (특수 효과 없음)
 * 대부분의 일반 명마가 이 클래스를 상속
 */
export abstract class BasicMount extends MountBase {
  // 기본 구현만 사용하는 명마용
}

/**
 * 특수 효과가 있는 명마 클래스
 */
export abstract class SpecialMount extends MountBase {
  /** 특수 효과 ID */
  abstract readonly specialEffectId: string;
  
  /** 특수 효과 설명 */
  abstract readonly specialEffectDescription: string;

  /**
   * 아이템 정보 설명 (특수 효과 포함)
   */
  get info(): string {
    const baseInfo = `통솔 +${this.statValue}`;
    return `${baseInfo}\n${this.specialEffectDescription}`;
  }

  getEffect(): MountEffect {
    return {
      ...super.getEffect(),
      special: this.specialEffectId,
    };
  }
}


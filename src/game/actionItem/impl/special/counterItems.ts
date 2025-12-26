/**
 * 반계 아이템 모음
 * PHP 대응: ActionItem/che_반계_*.php
 * 상대 계략 반사 아이템
 */

import { BaseItem } from '../../BaseItem';
import type { WarUnit } from '../../../../battle/WarUnit';
import type { WarUnitTriggerCaller } from '../../../triggers/WarUnitTriggerCaller';

/** 백우선 - 반계 */
export class CheBangyeBaekuseonItem extends BaseItem {
  get id(): string { return 'che_반계_백우선'; }

  constructor() {
    super();
    this.rawName = '백우선';
    this.name = '백우선(반계)';
    this.info = '[전투] 상대의 계략 성공 확률 -10%p, 상대의 계략을 30% 확률로 되돌림, 반목 성공시 대미지 추가(+40%), 소모 군량 +10%';
    this.cost = 200;
    this.consumable = false;
  }

  override onCalcOpposeStat(_general: any, statName: string, value: number, _aux?: any): number {
    if (statName === 'warMagicSuccessProb') {
      return value - 0.1;
    }
    return value;
  }

  override onCalcStat(_general: any, statName: string, value: number, aux?: any): number {
    if (statName === 'killRice') {
      return value * 1.1;
    }
    if (statName === 'warMagicSuccessDamage' && aux === '반목') {
      return value + 0.4;
    }
    return value;
  }

  // 반계 트리거는 별도 트리거 클래스에서 처리
  // override getBattlePhaseSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null { ... }
}

/** 파초선 - 반계 */
export class CheBangyePachoseonItem extends BaseItem {
  get id(): string { return 'che_반계_파초선'; }

  constructor() {
    super();
    this.rawName = '파초선';
    this.name = '파초선(반계)';
    this.info = '[전투] 상대의 계략 성공 확률 -15%p, 상대의 계략을 40% 확률로 되돌림, 반목 성공시 대미지 추가(+60%), 소모 군량 +15%';
    this.cost = 200;
    this.consumable = false;
    this.buyable = false;
  }

  override onCalcOpposeStat(_general: any, statName: string, value: number, _aux?: any): number {
    if (statName === 'warMagicSuccessProb') {
      return value - 0.15;
    }
    return value;
  }

  override onCalcStat(_general: any, statName: string, value: number, aux?: any): number {
    if (statName === 'killRice') {
      return value * 1.15;
    }
    if (statName === 'warMagicSuccessDamage' && aux === '반목') {
      return value + 0.6;
    }
    return value;
  }
}

// 모든 반계 아이템 export
export const ALL_COUNTER_ITEMS = [
  CheBangyeBaekuseonItem,
  CheBangyePachoseonItem,
] as const;

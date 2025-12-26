/**
 * 계략 아이템 모음
 * PHP 대응: ActionItem/che_계략_*.php
 * 계략 성공률/대미지 증가 아이템
 */

import { BaseItem } from '../../BaseItem';

/** 삼략 - 계략 강화 */
export class CheGyeryakSamryakItem extends BaseItem {
  get id(): string { return 'che_계략_삼략'; }

  constructor() {
    super();
    this.rawName = '삼략';
    this.name = '삼략(계략)';
    this.info = '[계략] 화계·탈취·파괴·선동 : 성공률 +20%p\n[전투] 계략 시도 확률 +10%p, 계략 성공 확률 +10%p';
    this.cost = 200;
    this.consumable = false;
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '계략') {
      if (varType === 'success') return value + 0.2;
    }
    return value;
  }

  override onCalcStat(_general: any, statName: string, value: number, _aux?: any): number {
    if (statName === 'warMagicTrialProb') {
      return value + 0.1;
    }
    if (statName === 'warMagicSuccessProb') {
      return value + 0.1;
    }
    return value;
  }
}

/** 육도 - 계략 강화 */
export class CheGyeryakYukdoItem extends BaseItem {
  get id(): string { return 'che_계략_육도'; }

  constructor() {
    super();
    this.rawName = '육도';
    this.name = '육도(계략)';
    this.info = '[계략] 화계·탈취·파괴·선동 : 성공률 +15%p\n[전투] 계략 시도 확률 +8%p, 계략 성공 확률 +8%p';
    this.cost = 180;
    this.consumable = false;
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '계략') {
      if (varType === 'success') return value + 0.15;
    }
    return value;
  }

  override onCalcStat(_general: any, statName: string, value: number, _aux?: any): number {
    if (statName === 'warMagicTrialProb') {
      return value + 0.08;
    }
    if (statName === 'warMagicSuccessProb') {
      return value + 0.08;
    }
    return value;
  }
}

/** 이추 - 계략 강화 */
export class CheGyeryakIchuItem extends BaseItem {
  get id(): string { return 'che_계략_이추'; }

  constructor() {
    super();
    this.rawName = '이추';
    this.name = '이추(계략)';
    this.info = '[계략] 화계·탈취·파괴·선동 : 성공률 +10%p\n[전투] 계략 시도 확률 +5%p, 계략 성공 확률 +5%p';
    this.cost = 150;
    this.consumable = false;
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '계략') {
      if (varType === 'success') return value + 0.1;
    }
    return value;
  }

  override onCalcStat(_general: any, statName: string, value: number, _aux?: any): number {
    if (statName === 'warMagicTrialProb') {
      return value + 0.05;
    }
    if (statName === 'warMagicSuccessProb') {
      return value + 0.05;
    }
    return value;
  }
}

/** 향낭 - 계략 강화 (소모품) */
export class CheGyeryakHyangnangItem extends BaseItem {
  get id(): string { return 'che_계략_향낭'; }

  constructor() {
    super();
    this.rawName = '향낭';
    this.name = '향낭(계략)';
    this.info = '[계략] 화계·탈취·파괴·선동 : 성공률 +5%p\n[전투] 계략 성공 확률 +3%p';
    this.cost = 100;
    this.consumable = true;
    this.buyable = true;
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '계략') {
      if (varType === 'success') return value + 0.05;
    }
    return value;
  }

  override onCalcStat(_general: any, statName: string, value: number, _aux?: any): number {
    if (statName === 'warMagicSuccessProb') {
      return value + 0.03;
    }
    return value;
  }
}

// 모든 계략 아이템 export
export const ALL_STRATEGY_ITEMS = [
  CheGyeryakSamryakItem,
  CheGyeryakYukdoItem,
  CheGyeryakIchuItem,
  CheGyeryakHyangnangItem,
] as const;

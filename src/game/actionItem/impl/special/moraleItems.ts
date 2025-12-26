/**
 * 사기/훈련 아이템 모음
 * PHP 대응: ActionItem/che_사기_*.php, che_훈련_*.php
 * 사기 및 훈련도 관련 아이템
 */

import { BaseItem } from '../../BaseItem';

/** 두강주 - 사기 */
export class CheSagiDugangItem extends BaseItem {
  get id(): string { return 'che_사기_두강주'; }

  constructor() {
    super();
    this.rawName = '두강주';
    this.name = '두강주(사기)';
    this.info = '[군사] 사기 +15\n[전투] 전투 시작 사기 +5';
    this.cost = 100;
    this.consumable = true;
    this.buyable = true;
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '사기') {
      if (varType === 'bonus') return value + 15;
    }
    return value;
  }

  override onCalcStat(_general: any, statName: string, value: number, _aux?: any): number {
    if (statName === 'warStartAtmos') {
      return value + 5;
    }
    return value;
  }
}

/** 보령압주 - 사기 */
export class CheSagiBoryeongItem extends BaseItem {
  get id(): string { return 'che_사기_보령압주'; }

  constructor() {
    super();
    this.rawName = '보령압주';
    this.name = '보령압주(사기)';
    this.info = '[군사] 사기 +20\n[전투] 전투 시작 사기 +8';
    this.cost = 150;
    this.consumable = true;
    this.buyable = true;
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '사기') {
      if (varType === 'bonus') return value + 20;
    }
    return value;
  }

  override onCalcStat(_general: any, statName: string, value: number, _aux?: any): number {
    if (statName === 'warStartAtmos') {
      return value + 8;
    }
    return value;
  }
}

/** 탁주 - 사기 */
export class CheSagiTakjuItem extends BaseItem {
  get id(): string { return 'che_사기_탁주'; }

  constructor() {
    super();
    this.rawName = '탁주';
    this.name = '탁주(사기)';
    this.info = '[군사] 사기 +10\n[전투] 전투 시작 사기 +3';
    this.cost = 50;
    this.consumable = true;
    this.buyable = true;
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '사기') {
      if (varType === 'bonus') return value + 10;
    }
    return value;
  }

  override onCalcStat(_general: any, statName: string, value: number, _aux?: any): number {
    if (statName === 'warStartAtmos') {
      return value + 3;
    }
    return value;
  }
}

/** 의적주 - 사기 (특수) */
export class CheSagiUijeokItem extends BaseItem {
  get id(): string { return 'che_사기_의적주'; }

  constructor() {
    super();
    this.rawName = '의적주';
    this.name = '의적주(사기)';
    this.info = '[군사] 사기 +25, 훈련도 +5\n[전투] 전투 시작 사기 +10';
    this.cost = 180;
    this.consumable = true;
    this.buyable = true;
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '사기') {
      if (varType === 'bonus') return value + 25;
    }
    if (turnType === '훈련') {
      if (varType === 'bonus') return value + 5;
    }
    return value;
  }

  override onCalcStat(_general: any, statName: string, value: number, _aux?: any): number {
    if (statName === 'warStartAtmos') {
      return value + 10;
    }
    return value;
  }
}

/** 철벽서 - 훈련 */
export class CheHunryeonCheolbyeokItem extends BaseItem {
  get id(): string { return 'che_훈련_철벽서'; }

  constructor() {
    super();
    this.rawName = '철벽서';
    this.name = '철벽서(훈련)';
    this.info = '[군사] 훈련 효율 +50%\n[전투] 피해 감소 +5%';
    this.cost = 150;
    this.consumable = false;
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '훈련') {
      if (varType === 'score') return value * 1.5;
    }
    return value;
  }

  override onCalcStat(_general: any, statName: string, value: number, _aux?: any): number {
    if (statName === 'warDefenceMultiplier') {
      return value * 0.95;
    }
    return value;
  }
}

/** 청주 - 훈련 */
export class CheHunryeonCheongjuItem extends BaseItem {
  get id(): string { return 'che_훈련_청주'; }

  constructor() {
    super();
    this.rawName = '청주';
    this.name = '청주(훈련)';
    this.info = '[군사] 훈련 효율 +30%, 사기 +10';
    this.cost = 100;
    this.consumable = true;
    this.buyable = true;
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '훈련') {
      if (varType === 'score') return value * 1.3;
    }
    if (turnType === '사기') {
      if (varType === 'bonus') return value + 10;
    }
    return value;
  }
}

// 모든 사기/훈련 아이템 export
export const ALL_MORALE_ITEMS = [
  CheSagiDugangItem,
  CheSagiBoryeongItem,
  CheSagiTakjuItem,
  CheSagiUijeokItem,
  CheHunryeonCheolbyeokItem,
  CheHunryeonCheongjuItem,
] as const;

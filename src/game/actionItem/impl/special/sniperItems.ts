/**
 * 저격 아이템 모음
 * PHP 대응: ActionItem/che_저격_*.php
 * 저격 성공률 증가 아이템
 */

import { BaseItem } from '../../BaseItem';

/** 매화수전 - 저격 */
export class CheJeogyeokMaehwaItem extends BaseItem {
  get id(): string { return 'che_저격_매화수전'; }

  constructor() {
    super();
    this.rawName = '매화수전';
    this.name = '매화수전(저격)';
    this.info = '[전투] 저격 성공 확률 +20%p, 저격 대미지 +30%';
    this.cost = 200;
    this.consumable = false;
    this.buyable = false;
  }

  override onCalcStat(_general: any, statName: string, value: number, _aux?: any): number {
    if (statName === 'warSniperSuccessProb') {
      return value + 0.2;
    }
    if (statName === 'warSniperDamage') {
      return value * 1.3;
    }
    return value;
  }
}

/** 비도 - 저격 */
export class CheJeogyeokBidoItem extends BaseItem {
  get id(): string { return 'che_저격_비도'; }

  constructor() {
    super();
    this.rawName = '비도';
    this.name = '비도(저격)';
    this.info = '[전투] 저격 성공 확률 +15%p, 저격 대미지 +20%';
    this.cost = 180;
    this.consumable = false;
  }

  override onCalcStat(_general: any, statName: string, value: number, _aux?: any): number {
    if (statName === 'warSniperSuccessProb') {
      return value + 0.15;
    }
    if (statName === 'warSniperDamage') {
      return value * 1.2;
    }
    return value;
  }
}

/** 수극 - 저격 */
export class CheJeogyeokSugeukItem extends BaseItem {
  get id(): string { return 'che_저격_수극'; }

  constructor() {
    super();
    this.rawName = '수극';
    this.name = '수극(저격)';
    this.info = '[전투] 저격 성공 확률 +10%p, 저격 대미지 +15%';
    this.cost = 150;
    this.consumable = false;
  }

  override onCalcStat(_general: any, statName: string, value: number, _aux?: any): number {
    if (statName === 'warSniperSuccessProb') {
      return value + 0.1;
    }
    if (statName === 'warSniperDamage') {
      return value * 1.15;
    }
    return value;
  }
}

// 모든 저격 아이템 export
export const ALL_SNIPER_ITEMS = [
  CheJeogyeokMaehwaItem,
  CheJeogyeokBidoItem,
  CheJeogyeokSugeukItem,
] as const;

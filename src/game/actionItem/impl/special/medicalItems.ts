/**
 * 의술 아이템 모음
 * PHP 대응: ActionItem/che_의술_*.php, che_치료_*.php
 * 부상 회복 및 치료 관련 아이템
 */

import { BaseItem } from '../../BaseItem';

/** 상한잡병론 - 의술 */
export class CheUisulSanghanItem extends BaseItem {
  get id(): string { return 'che_의술_상한잡병론'; }

  constructor() {
    super();
    this.rawName = '상한잡병론';
    this.name = '상한잡병론(의술)';
    this.info = '[군사] 부상 회복 효율 +50%\n[전투] 전투 중 병력 회복 +5%';
    this.cost = 180;
    this.consumable = false;
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '치료' || turnType === '부상') {
      if (varType === 'score') return value * 1.5;
    }
    return value;
  }

  override onCalcStat(_general: any, statName: string, value: number, _aux?: any): number {
    if (statName === 'warHealRatio') {
      return value + 0.05;
    }
    return value;
  }
}

/** 청낭서 - 의술 */
export class CheUisulCheongnangseoItem extends BaseItem {
  get id(): string { return 'che_의술_청낭서'; }

  constructor() {
    super();
    this.rawName = '청낭서';
    this.name = '청낭서(의술)';
    this.info = '[군사] 부상 회복 효율 +100%\n[전투] 전투 중 병력 회복 +10%';
    this.cost = 200;
    this.consumable = false;
    this.buyable = false;
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '치료' || turnType === '부상') {
      if (varType === 'score') return value * 2.0;
    }
    return value;
  }

  override onCalcStat(_general: any, statName: string, value: number, _aux?: any): number {
    if (statName === 'warHealRatio') {
      return value + 0.1;
    }
    return value;
  }
}

/** 태평청령 - 의술 */
export class CheUisulTaepyeongItem extends BaseItem {
  get id(): string { return 'che_의술_태평청령'; }

  constructor() {
    super();
    this.rawName = '태평청령';
    this.name = '태평청령(의술)';
    this.info = '[군사] 부상 회복 효율 +80%\n[전투] 전투 중 병력 회복 +8%, 사기 회복 +5';
    this.cost = 200;
    this.consumable = false;
    this.buyable = false;
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '치료' || turnType === '부상') {
      if (varType === 'score') return value * 1.8;
    }
    return value;
  }

  override onCalcStat(_general: any, statName: string, value: number, _aux?: any): number {
    if (statName === 'warHealRatio') {
      return value + 0.08;
    }
    if (statName === 'warAtmosHeal') {
      return value + 5;
    }
    return value;
  }
}

/** 정력견혈산 - 치료제 */
export class CheTiryoJeongryeokItem extends BaseItem {
  get id(): string { return 'che_의술_정력견혈산'; }

  constructor() {
    super();
    this.rawName = '정력견혈산';
    this.name = '정력견혈산(치료)';
    this.info = '[군사] 부상 회복 효율 +30%';
    this.cost = 100;
    this.consumable = true;
    this.buyable = true;
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '치료' || turnType === '부상') {
      if (varType === 'score') return value * 1.3;
    }
    return value;
  }
}

/** 도소연명 - 치료제 (사기 회복) */
export class CheTiryoDosoItem extends BaseItem {
  get id(): string { return 'che_치료_도소연명'; }

  constructor() {
    super();
    this.rawName = '도소연명';
    this.name = '도소연명(치료)';
    this.info = '[군사] 부상 완전 회복, 사기 +20';
    this.cost = 150;
    this.consumable = true;
    this.buyable = true;
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '치료' || turnType === '부상') {
      if (varType === 'score') return value * 2.0;
    }
    if (turnType === '사기') {
      if (varType === 'bonus') return value + 20;
    }
    return value;
  }
}

// 모든 의술 아이템 export
export const ALL_MEDICAL_ITEMS = [
  CheUisulSanghanItem,
  CheUisulCheongnangseoItem,
  CheUisulTaepyeongItem,
  CheTiryoJeongryeokItem,
  CheTiryoDosoItem,
] as const;

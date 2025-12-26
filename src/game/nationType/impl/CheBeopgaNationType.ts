/**
 * 법가 국가유형
 * PHP 대응: ActionNationType/che_법가.php
 */

import { BaseNationType } from '../BaseNationType';

export class CheBeopgaNationType extends BaseNationType {
  get id(): string {
    return 'che_법가';
  }

  getName(): string {
    return '법가';
  }

  getPros(): string {
    return '금수입↑ 치안↑';
  }

  getCons(): string {
    return '인구↓ 민심↓';
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '치안') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    } else if (turnType === '민심' || turnType === '인구') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    }
    return value;
  }

  override onCalcNationalIncome(type: string, amount: number): number {
    if (type === 'gold') {
      return amount * 1.1;
    }
    if (type === 'pop' && amount > 0) {
      return amount * 0.8;
    }
    return amount;
  }
}

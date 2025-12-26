/**
 * 도적 국가유형
 * PHP 대응: ActionNationType/che_도적.php
 */

import { BaseNationType } from '../BaseNationType';

export class CheDojeokNationType extends BaseNationType {
  get id(): string {
    return 'che_도적';
  }

  getName(): string {
    return '도적';
  }

  getPros(): string {
    return '계략↑';
  }

  getCons(): string {
    return '금수입↓ 치안↓ 민심↓';
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '치안') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    } else if (turnType === '민심' || turnType === '인구') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    } else if (turnType === '계략') {
      if (varType === 'success') return value + 0.1;
    }
    return value;
  }

  override onCalcNationalIncome(type: string, amount: number): number {
    if (type === 'gold') {
      return amount * 0.9;
    }
    return amount;
  }
}

/**
 * 도가 국가유형
 * PHP 대응: ActionNationType/che_도가.php
 */

import { BaseNationType } from '../BaseNationType';

export class CheDogaNationType extends BaseNationType {
  get id(): string {
    return 'che_도가';
  }

  getName(): string {
    return '도가';
  }

  getPros(): string {
    return '인구↑';
  }

  getCons(): string {
    return '기술↓ 치안↓';
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '기술') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    } else if (turnType === '치안') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    }
    return value;
  }

  override onCalcNationalIncome(type: string, amount: number): number {
    if (type === 'pop' && amount > 0) {
      return amount * 1.2;
    }
    return amount;
  }
}

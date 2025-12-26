/**
 * 유가 국가유형
 * PHP 대응: ActionNationType/che_유가.php
 */

import { BaseNationType } from '../BaseNationType';

export class CheYugaNationType extends BaseNationType {
  get id(): string {
    return 'che_유가';
  }

  getName(): string {
    return '유가';
  }

  getPros(): string {
    return '농상↑ 민심↑';
  }

  getCons(): string {
    return '쌀수입↓';
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '농업' || turnType === '상업') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    } else if (turnType === '민심' || turnType === '인구') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    }
    return value;
  }

  override onCalcNationalIncome(type: string, amount: number): number {
    if (type === 'rice') {
      return amount * 0.9;
    }
    return amount;
  }
}

/**
 * 명가 국가유형
 * PHP 대응: ActionNationType/che_명가.php
 */

import { BaseNationType } from '../BaseNationType';

export class CheMyeonggaNationType extends BaseNationType {
  get id(): string {
    return 'che_명가';
  }

  getName(): string {
    return '명가';
  }

  getPros(): string {
    return '기술↑ 인구↑';
  }

  getCons(): string {
    return '쌀수입↓ 수성↓';
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '기술') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    } else if (turnType === '수비' || turnType === '성벽') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    }
    return value;
  }

  override onCalcNationalIncome(type: string, amount: number): number {
    if (type === 'rice') {
      return amount * 0.9;
    }
    if (type === 'pop' && amount > 0) {
      return amount * 1.2;
    }
    return amount;
  }
}

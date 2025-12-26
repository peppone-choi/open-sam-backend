/**
 * 오두미도 국가유형
 * PHP 대응: ActionNationType/che_오두미도.php
 */

import { BaseNationType } from '../BaseNationType';

export class CheOdumidoNationType extends BaseNationType {
  get id(): string {
    return 'che_오두미도';
  }

  getName(): string {
    return '오두미도';
  }

  getPros(): string {
    return '쌀수입↑ 인구↑';
  }

  getCons(): string {
    return '기술↓ 수성↓ 농상↓';
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '기술') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    } else if (turnType === '수비' || turnType === '성벽') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    } else if (turnType === '농업' || turnType === '상업') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    }
    return value;
  }

  override onCalcNationalIncome(type: string, amount: number): number {
    if (type === 'rice') {
      return amount * 1.1;
    }
    if (type === 'pop' && amount > 0) {
      return amount * 1.2;
    }
    return amount;
  }
}

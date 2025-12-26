/**
 * 음양가 국가유형
 * PHP 대응: ActionNationType/che_음양가.php
 */

import { BaseNationType } from '../BaseNationType';

export class CheEumyanggaNationType extends BaseNationType {
  get id(): string {
    return 'che_음양가';
  }

  getName(): string {
    return '음양가';
  }

  getPros(): string {
    return '농상↑ 인구↑';
  }

  getCons(): string {
    return '기술↓ 전략↓';
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '농업' || turnType === '상업') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    } else if (turnType === '기술') {
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

  override onCalcStrategic(_turnType: string, varType: string, value: number): number {
    if (varType === 'delay') {
      return Math.round((value * 4) / 3);
    }
    return value;
  }
}

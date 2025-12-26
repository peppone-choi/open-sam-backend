/**
 * 종횡가 국가유형
 * PHP 대응: ActionNationType/che_종횡가.php
 */

import { BaseNationType } from '../BaseNationType';

export class CheJonghoenggaNationType extends BaseNationType {
  get id(): string {
    return 'che_종횡가';
  }

  getName(): string {
    return '종횡가';
  }

  getPros(): string {
    return '전략↑ 수성↑';
  }

  getCons(): string {
    return '금수입↓ 농상↓';
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '수비' || turnType === '성벽') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    } else if (turnType === '농업' || turnType === '상업') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    }
    return value;
  }

  override onCalcNationalIncome(type: string, amount: number): number {
    if (type === 'gold') {
      return amount * 0.9;
    }
    return amount;
  }

  override onCalcStrategic(_turnType: string, varType: string, value: number): number {
    if (varType === 'delay') {
      return Math.round((value * 3) / 4);
    }
    if (varType === 'globalDelay') {
      return Math.round(value / 2);
    }
    return value;
  }
}

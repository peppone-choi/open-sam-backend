/**
 * 병가 국가유형
 * PHP 대응: ActionNationType/che_병가.php
 */

import { BaseNationType } from '../BaseNationType';

export class CheByeonggaNationType extends BaseNationType {
  get id(): string {
    return 'che_병가';
  }

  getName(): string {
    return '병가';
  }

  getPros(): string {
    return '기술↑ 수성↑';
  }

  getCons(): string {
    return '인구↓ 민심↓';
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '기술') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    } else if (turnType === '수비' || turnType === '성벽') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    } else if (turnType === '민심' || turnType === '인구') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    }
    return value;
  }

  override onCalcNationalIncome(type: string, amount: number): number {
    if (type === 'pop' && amount > 0) {
      return amount * 0.8;
    }
    return amount;
  }
}

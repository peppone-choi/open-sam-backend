/**
 * 태평도 국가유형
 * PHP 대응: ActionNationType/che_태평도.php
 */

import { BaseNationType } from '../BaseNationType';

export class CheTaepyeongdoNationType extends BaseNationType {
  get id(): string {
    return 'che_태평도';
  }

  getName(): string {
    return '태평도';
  }

  getPros(): string {
    return '인구↑ 민심↑';
  }

  getCons(): string {
    return '기술↓ 수성↓';
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '민심' || turnType === '인구') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    } else if (turnType === '기술') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    } else if (turnType === '수비' || turnType === '성벽') {
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

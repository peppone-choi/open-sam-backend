/**
 * 불가 국가유형
 * PHP 대응: ActionNationType/che_불가.php
 */

import { BaseNationType } from '../BaseNationType';

export class CheBulgaNationType extends BaseNationType {
  get id(): string {
    return 'che_불가';
  }

  getName(): string {
    return '불가';
  }

  getPros(): string {
    return '민심↑ 수성↑';
  }

  getCons(): string {
    return '금수입↓';
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '민심' || turnType === '인구') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    } else if (turnType === '수비' || turnType === '성벽') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
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

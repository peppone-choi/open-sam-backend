/**
 * 묵가 국가유형
 * PHP 대응: ActionNationType/che_묵가.php
 */

import { BaseNationType } from '../BaseNationType';

export class CheMukgaNationType extends BaseNationType {
  get id(): string {
    return 'che_묵가';
  }

  getName(): string {
    return '묵가';
  }

  getPros(): string {
    return '수성↑';
  }

  getCons(): string {
    return '기술↓';
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '수비' || turnType === '성벽') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
    } else if (turnType === '기술') {
      if (varType === 'score') return value * 0.9;
      if (varType === 'cost') return value * 1.2;
    }
    return value;
  }
}

/**
 * 내정 특기: 거상
 * PHP 대응: ActionSpecialDomestic\che_거상
 * 
 * 효과: 상업 투자 효율 +20%
 */

import { BaseSpecialDomestic } from '../BaseSpecialDomestic';

export class CheGeosangSpecialDomestic extends BaseSpecialDomestic {
  get id(): string {
    return 'che_거상';
  }
  
  getName(): string {
    return '거상';
  }
  
  getInfo(): string {
    return '상업 투자 효율 +20%';
  }
  
  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    // 상업 투자 효율 증가
    if (turnType === '상업' && varType === 'score') {
      return value * 1.2;
    }
    return value;
  }
}





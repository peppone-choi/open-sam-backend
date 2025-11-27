/**
 * 내정 특기: 수비
 * PHP 대응: ActionSpecialDomestic\che_수비
 * 
 * 효과: 수비 강화 효율 +20%
 */

import { BaseSpecialDomestic } from '../BaseSpecialDomestic';

export class CheSubiSpecialDomestic extends BaseSpecialDomestic {
  get id(): string {
    return 'che_수비';
  }
  
  getName(): string {
    return '수비';
  }
  
  getInfo(): string {
    return '수비 강화 효율 +20%';
  }
  
  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    // 수비 투자 효율 증가
    if (turnType === '수비' && varType === 'score') {
      return value * 1.2;
    }
    return value;
  }
}


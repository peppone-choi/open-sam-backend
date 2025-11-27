/**
 * 내정 특기: 경작
 * PHP 대응: ActionSpecialDomestic\che_경작
 * 
 * 효과: 농지 개간 효율 +20%
 */

import { BaseSpecialDomestic } from '../BaseSpecialDomestic';

export class CheGyeongjakSpecialDomestic extends BaseSpecialDomestic {
  get id(): string {
    return 'che_경작';
  }
  
  getName(): string {
    return '경작';
  }
  
  getInfo(): string {
    return '농지 개간 효율 +20%';
  }
  
  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    // 농업 투자 효율 증가
    if (turnType === '농업' && varType === 'score') {
      return value * 1.2;
    }
    return value;
  }
}


/**
 * 내정 특기: 귀모
 * PHP 대응: ActionSpecialDomestic\che_귀모
 * 
 * 효과: 계략 성공률 +10%
 */

import { BaseSpecialDomestic } from '../BaseSpecialDomestic';

export class CheGwimoSpecialDomestic extends BaseSpecialDomestic {
  get id(): string {
    return 'che_귀모';
  }
  
  getName(): string {
    return '귀모';
  }
  
  getInfo(): string {
    return '계략 성공률 +10%';
  }
  
  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    // 계략 성공률 증가
    if ((turnType === '화계' || turnType === '계략') && varType === 'success') {
      return value * 1.1;
    }
    return value;
  }
}





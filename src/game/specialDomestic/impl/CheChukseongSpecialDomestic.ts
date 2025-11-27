/**
 * 내정 특기: 축성
 * PHP 대응: ActionSpecialDomestic\che_축성
 * 
 * 효과: 성벽 강화 효율 +20%
 */

import { BaseSpecialDomestic } from '../BaseSpecialDomestic';

export class CheChukseongSpecialDomestic extends BaseSpecialDomestic {
  get id(): string {
    return 'che_축성';
  }
  
  getName(): string {
    return '축성';
  }
  
  getInfo(): string {
    return '성벽 강화 효율 +20%';
  }
  
  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    // 성벽 투자 효율 증가
    if (turnType === '성벽' && varType === 'score') {
      return value * 1.2;
    }
    return value;
  }
}


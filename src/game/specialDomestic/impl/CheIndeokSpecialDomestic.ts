/**
 * 내정 특기: 인덕
 * PHP 대응: ActionSpecialDomestic\che_인덕
 * 
 * 효과: 선정 효율 +30%, 징병량 +10%
 */

import { BaseSpecialDomestic } from '../BaseSpecialDomestic';

export class CheIndeokSpecialDomestic extends BaseSpecialDomestic {
  get id(): string {
    return 'che_인덕';
  }
  
  getName(): string {
    return '인덕';
  }
  
  getInfo(): string {
    return '선정 효율 +30%, 징병량 +10%';
  }
  
  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    // 선정 효율 증가
    if (turnType === '선정' && varType === 'score') {
      return value * 1.3;
    }
    // 징병량 증가
    if (turnType === '징병' && varType === 'crew') {
      return value * 1.1;
    }
    return value;
  }
}


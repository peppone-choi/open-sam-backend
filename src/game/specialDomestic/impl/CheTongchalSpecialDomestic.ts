/**
 * 내정 특기: 통찰
 * PHP 대응: ActionSpecialDomestic\che_통찰
 * 
 * 효과: 등용 성공률 +20%, 정찰 정확도 +20%
 */

import { BaseSpecialDomestic } from '../BaseSpecialDomestic';

export class CheTongchalSpecialDomestic extends BaseSpecialDomestic {
  get id(): string {
    return 'che_통찰';
  }
  
  getName(): string {
    return '통찰';
  }
  
  getInfo(): string {
    return '등용 성공률 +20%, 정찰 정확도 +20%';
  }
  
  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    // 등용 성공률 증가
    if (turnType === '등용' && varType === 'success') {
      return value * 1.2;
    }
    // 정찰 정확도 증가
    if (turnType === '정찰' && varType === 'accuracy') {
      return value * 1.2;
    }
    return value;
  }
}





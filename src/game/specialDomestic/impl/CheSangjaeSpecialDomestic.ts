/**
 * 상재 내정 특기
 * PHP 대응: che_상재.php
 * [내정] 상업 투자 : 기본 보정 +10%, 성공률 +10%p, 비용 -20%
 */

import { BaseSpecialDomestic } from '../BaseSpecialDomestic';

export class CheSangjaeSpecialDomestic extends BaseSpecialDomestic {
  get id(): string {
    return 'che_상재';
  }

  getName(): string {
    return '상재';
  }

  getInfo(): string {
    return '[내정] 상업 투자 : 기본 보정 +10%, 성공률 +10%p, 비용 -20%';
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '상업') {
      if (varType === 'score') return value * 1.1;
      if (varType === 'cost') return value * 0.8;
      if (varType === 'success') return value + 0.1;
    }
    return value;
  }
}

/**
 * 내정 특기 없음
 * PHP 대응: ActionSpecialDomestic\None
 */

import { BaseSpecialDomestic } from '../BaseSpecialDomestic';

export class NoneSpecialDomestic extends BaseSpecialDomestic {
  get id(): string {
    return 'None';
  }
  
  getName(): string {
    return '-';
  }
  
  getInfo(): string {
    return '특기 없음';
  }
}


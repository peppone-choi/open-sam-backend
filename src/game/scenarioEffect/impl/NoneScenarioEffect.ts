/**
 * 시나리오 효과 없음
 * PHP 대응: ActionScenarioEffect\None
 */

import { BaseScenarioEffect } from '../BaseScenarioEffect';

export class NoneScenarioEffect extends BaseScenarioEffect {
  get id(): number {
    return -1;
  }
  
  get name(): string {
    return '-';
  }
  
  get info(): string {
    return '';
  }
}


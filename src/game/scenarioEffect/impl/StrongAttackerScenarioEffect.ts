/**
 * 시나리오 효과: 강력한 공격자
 * PHP 대응: ActionScenarioEffect\event_StrongAttacker
 * 
 * 효과: 공격자 전투력 증가
 */

import { BaseScenarioEffect } from '../BaseScenarioEffect';
import type { WarUnit } from '../../../battle/WarUnit';

export class StrongAttackerScenarioEffect extends BaseScenarioEffect {
  get id(): number {
    return 2;
  }
  
  get name(): string {
    return '강력한 공격자';
  }
  
  get info(): string {
    return '공격자 전투력 증가';
  }
  
  /**
   * 전투력 배수
   * 공격자일 경우 전투력 보너스
   */
  getWarPowerMultiplier(unit: WarUnit): [number, number] {
    if (unit.isAttackerUnit()) {
      return [1.2, 0.9];
    }
    return [1, 1];
  }
}


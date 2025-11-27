/**
 * 시나리오 효과: 더 많은 효과
 * PHP 대응: ActionScenarioEffect\event_MoreEffect
 * 
 * 효과: 내정/수입 2배, 공격 시 전투력 +40%
 */

import { BaseScenarioEffect } from '../BaseScenarioEffect';
import type { WarUnit } from '../../../battle/WarUnit';

export class MoreEffectScenarioEffect extends BaseScenarioEffect {
  get id(): number {
    return 1;
  }
  
  get name(): string {
    return '더 많은 효과';
  }
  
  get info(): string {
    return '내정/수입 2배, 공격 시 전투력 +40%';
  }
  
  /**
   * 전투력 배수
   * 공격자일 경우 공격력 1.4배, 상대 방어력 0.7143배
   */
  getWarPowerMultiplier(unit: WarUnit): [number, number] {
    if (unit.isAttackerUnit()) {
      return [1.4, 0.7143];
    }
    return [1, 1];
  }
  
  /**
   * 내정 효과 2배
   */
  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    const scoreMap: Record<string, number> = {
      '상업': 2,
      '농업': 2,
      '치안': 2,
      '기술': 2,
      '성벽': 2,
      '수비': 2,
      '인구': 2,
      '민심': 2,
    };
    
    if (turnType === 'changeDefenceTrain') {
      return 0;
    }
    
    if (varType === 'score' && turnType in scoreMap) {
      return value * scoreMap[turnType];
    }
    
    return value;
  }
  
  /**
   * 국가 수입 2배
   */
  onCalcNationalIncome(type: string, amount: number): number {
    if (type === 'gold') {
      return amount * 2;
    }
    if (type === 'rice') {
      return amount * 2;
    }
    if (type === 'pop' && amount > 0) {
      return amount * 2;
    }
    return amount;
  }
}


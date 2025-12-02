/**
 * 시나리오 효과 베이스 클래스
 * PHP 대응: core/hwe/sammo/ActionScenarioEffect/
 */

import type { GameAction } from '../actions/Action';
import type { WarUnit } from '../../battle/WarUnit';
import type { WarUnitTriggerCaller } from '../triggers/WarUnitTriggerCaller';

export abstract class BaseScenarioEffect implements GameAction {
  abstract get id(): number;
  abstract get name(): string;
  abstract get info(): string;
  
  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    return value;
  }
  
  onCalcStat(general: any, statName: string, value: any, aux?: any): any {
    return value;
  }
  
  onCalcOpposeStat(general: any, statName: string, value: any, aux?: any): any {
    return value;
  }
  
  onCalcNationalIncome(type: string, amount: number): number {
    return amount;
  }
  
  onCalcStrategic(turnType: string, varType: string, value: any, aux?: any): any {
    return value;
  }
  
  getWarPowerMultiplier(unit: WarUnit): [number, number] {
    return [1, 1];
  }
  
  getBattleInitSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null {
    return null;
  }
  
  getBattlePhaseSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null {
    return null;
  }
}





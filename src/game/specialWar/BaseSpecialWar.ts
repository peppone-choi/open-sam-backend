import type { WarUnit } from '../../battle/WarUnit';
import { WarUnitTriggerCaller } from '../triggers/WarUnitTriggerCaller';
import type { GameAction } from '../actions/Action';

export interface SpecialWarAction extends GameAction {
  readonly key: string;
  readonly name: string;
  readonly info: string;
}

export class BaseSpecialWar implements SpecialWarAction {
  constructor(
    public readonly key: string,
    public readonly name: string,
    public readonly info: string
  ) {}

  onCalcStat(_general: any, _statName: string, value: number, _aux?: any): number {
    return value;
  }

  onCalcOpposeStat(_general: any, _statName: string, value: number, _aux?: any): number {
    return value;
  }

  onCalcDomestic(_turnType: string, _varType: string, value: number, _aux?: any): number {
    return value;
  }

  getWarPowerMultiplier(_unit: any): [number, number] {
    return [1, 1];
  }

  getBattleInitSkillTriggerList(_unit: WarUnit): WarUnitTriggerCaller | null {
    return null;
  }

  getBattlePhaseSkillTriggerList(_unit: WarUnit): WarUnitTriggerCaller | null {
    return null;
  }
}

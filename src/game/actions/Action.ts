import type { WarUnit } from '../../battle/WarUnit';
import type { WarUnitTriggerCaller } from '../triggers/WarUnitTriggerCaller';

export interface GameAction {
  onCalcDomestic?(turnType: string, varType: string, value: number, aux?: any): number;
  onCalcStat?(general: any, statName: string, value: any, aux?: any): any;
  onCalcOpposeStat?(general: any, statName: string, value: any, aux?: any): any;
  onCalcNationalIncome?(type: string, amount: number): number;
  onCalcStrategic?(turnType: string, varType: string, value: any, aux?: any): any;
  onPreTurnExecute?(general: any, context?: Record<string, any>): Promise<boolean | void> | boolean | void;
  getWarPowerMultiplier?(unit: WarUnit): [number, number];
  getBattleInitSkillTriggerList?(unit: WarUnit): WarUnitTriggerCaller | null;
  getBattlePhaseSkillTriggerList?(unit: WarUnit): WarUnitTriggerCaller | null;
}

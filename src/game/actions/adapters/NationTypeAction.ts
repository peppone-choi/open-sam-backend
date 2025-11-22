import type { GameAction } from '../Action';
import type { BaseNationType } from '../../../core/nation-type/BaseNationType';
import type { WarUnit } from '../../../battle/WarUnit';

export class NationTypeAction implements GameAction {
  constructor(private readonly nationType: BaseNationType) {}

  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    if (varType === 'score' || varType === 'cost') {
      return this.nationType.onCalcDomestic(turnType, varType, value, aux);
    }
    return value;
  }

  onCalcNationalIncome(type: string, amount: number): number {
    if (type === 'gold' || type === 'rice' || type === 'pop') {
      return this.nationType.onCalcNationalIncome(type, amount);
    }
    return amount;
  }

  onCalcStrategic(turnType: string, varType: string, value: any, aux?: any): any {
    // Nation type 기본 구현 없음, 필요 시 확장
    return value;
  }

  getWarPowerMultiplier(_unit: WarUnit): [number, number] {
    return [1, 1];
  }
}

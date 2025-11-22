import type { WarUnit } from '../../../battle/WarUnit';
import { BaseSpecialWar } from '../BaseSpecialWar';
import { WarUnitTriggerCaller } from '../../triggers/WarUnitTriggerCaller';
import { ActivateSkillsTrigger } from '../../triggers/ActivateSkillsTrigger';

export class CheGyeonGoSpecialWar extends BaseSpecialWar {
  constructor() {
    super('che_견고', '견고', '[전투] 상대 필살 확률 -20%p, 상대 계략 성공 확률 -10%p, 아군 피해 -10%');
  }

  override onCalcOpposeStat(_general: any, statName: string, value: number, _aux?: any): number {
    if (typeof value !== 'number') {
      return value;
    }

    if (statName === 'warCriticalRatio') {
      return value - 0.2;
    }

    if (statName === 'warMagicSuccessProb') {
      return value - 0.1;
    }

    return value;
  }

  override getWarPowerMultiplier(_unit: any): [number, number] {
    return [1, 0.9];
  }

  private createNoInjuryCaller(unit: WarUnit): WarUnitTriggerCaller | null {
    if (!unit) {
      return null;
    }
    return new WarUnitTriggerCaller(new ActivateSkillsTrigger(unit, 'self', '부상무효'));
  }

  override getBattleInitSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null {
    return this.createNoInjuryCaller(unit);
  }

  override getBattlePhaseSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null {
    return this.createNoInjuryCaller(unit);
  }
}

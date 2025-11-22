import type { WarUnit } from '../../../battle/WarUnit';
import { BaseSpecialWar } from '../BaseSpecialWar';
import { WarUnitTriggerCaller } from '../../triggers/WarUnitTriggerCaller';
import { CheDolgeokPersistTrigger } from '../../triggers/effects/CheDolgeokPersistTrigger';

export class CheDolGyeokSpecialWar extends BaseSpecialWar {
  constructor() {
    super('che_돌격', '돌격', '[전투] 공격 시 페이즈 +2, 공격 대미지 +5%');
  }

  override onCalcStat(_general: any, statName: string, value: number, aux?: any): number {
    if (statName === 'initWarPhase' && typeof value === 'number') {
      return value + 2;
    }
    return value;
  }

  override getWarPowerMultiplier(unit: any): [number, number] {
    if (unit?.isAttackerUnit?.()) {
      return [1.05, 1];
    }
    return [1, 1];
  }

  override getBattlePhaseSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null {
    return new WarUnitTriggerCaller(new CheDolgeokPersistTrigger(unit));
  }
}

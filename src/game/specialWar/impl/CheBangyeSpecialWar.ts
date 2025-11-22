import type { WarUnit } from '../../../battle/WarUnit';
import { BaseSpecialWar } from '../BaseSpecialWar';
import { WarUnitTriggerCaller } from '../../triggers/WarUnitTriggerCaller';
import { CheBangyeAttemptTrigger } from '../../triggers/effects/CheBangyeAttemptTrigger';
import { CheBangyeActivateTrigger } from '../../triggers/effects/CheBangyeActivateTrigger';

export class CheBangyeSpecialWar extends BaseSpecialWar {
  constructor() {
    super('che_반계', '반계', '[전투] 상대 계략 성공 확률 -10%p, 40% 확률로 계략 반사, 반목 시 추가 대미지');
  }

  override onCalcStat(_general: any, statName: string, value: number, aux?: any): number {
    if (statName === 'warMagicSuccessDamage' && aux === '반목') {
      return value + 0.9;
    }
    return value;
  }

  override onCalcOpposeStat(_general: any, statName: string, value: number): number {
    if (statName === 'warMagicSuccessProb') {
      return value - 0.1;
    }
    return value;
  }

  override getBattlePhaseSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null {
    return new WarUnitTriggerCaller(
      new CheBangyeAttemptTrigger(unit),
      new CheBangyeActivateTrigger(unit)
    );
  }
}

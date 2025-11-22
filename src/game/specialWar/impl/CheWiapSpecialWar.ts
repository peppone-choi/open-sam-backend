import type { WarUnit } from '../../../battle/WarUnit';
import { BaseSpecialWar } from '../BaseSpecialWar';
import { WarUnitTriggerCaller } from '../../triggers/WarUnitTriggerCaller';
import { CheWiapAttemptTrigger } from '../../triggers/effects/CheWiapAttemptTrigger';
import { CheWiapActivateTrigger } from '../../triggers/effects/CheWiapActivateTrigger';

export class CheWiapSpecialWar extends BaseSpecialWar {
  constructor() {
    super('che_위압', '위압', '[전투] 첫 페이즈 위압 발동(적 공격, 회피 불가, 사기 감소)');
  }

  override getBattlePhaseSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null {
    return new WarUnitTriggerCaller(
      new CheWiapAttemptTrigger(unit),
      new CheWiapActivateTrigger(unit)
    );
  }
}

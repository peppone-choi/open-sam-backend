import type { WarUnit } from '../../../battle/WarUnit';
import { BaseSpecialWar } from '../BaseSpecialWar';
import { WarUnitTriggerCaller } from '../../triggers/WarUnitTriggerCaller';
import { CheGyuknoAttemptTrigger } from '../../triggers/effects/CheGyuknoAttemptTrigger';
import { CheGyuknoActivateTrigger } from '../../triggers/effects/CheGyuknoActivateTrigger';

export class CheGyuknoSpecialWar extends BaseSpecialWar {
  constructor() {
    super('che_격노', '격노', '[전투] 상대 필살·회피에 반응하여 격노 발동, 진노 시 페이즈 추가');
  }

  override getBattlePhaseSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null {
    return new WarUnitTriggerCaller(
      new CheGyuknoAttemptTrigger(unit),
      new CheGyuknoActivateTrigger(unit)
    );
  }
}

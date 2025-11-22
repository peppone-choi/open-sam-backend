import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';

export class CheGyuknoActivateTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_POST + 600);
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    _selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    _rng: RandUtil
  ): boolean {
    if (!self.hasActivatedSkill('격노')) {
      return true;
    }

    const targetAct = oppose.hasActivatedSkill('필살') ? '필살 공격' : '회피 시도';
    const reaction = self.hasActivatedSkill('진노') ? '진노' : '격노';

    self.getLogger().pushGeneralBattleDetailLog(`상대의 ${targetAct}에 <C>${reaction}</>했다!`);
    oppose.getLogger().pushGeneralBattleDetailLog(`${targetAct}에 상대가 <R>${reaction}</>했다!`);

    if (self.hasActivatedSkill('진노')) {
      self.addBonusPhase(1);
    }

    self.multiplyWarPowerMultiply(self.criticalDamage());
    return true;
  }
}

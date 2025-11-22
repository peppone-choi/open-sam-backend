import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';

export class CheJeontuChiryoActivateTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_POST + 550);
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    _rng: RandUtil
  ): boolean {
    if (!self.hasActivatedSkill('치료')) {
      return true;
    }
    if (selfEnv.healingActivated) {
      return true;
    }
    selfEnv.healingActivated = true;

    oppose.getLogger().pushGeneralBattleDetailLog('상대가 <R>치료</>했다!');
    self.getLogger().pushGeneralBattleDetailLog('<C>치료</>했다!');

    oppose.multiplyWarPowerMultiply(0.7);
    self.getGeneral().setVar?.('injury', 0);

    this.processConsumableItem();
    return true;
  }
}

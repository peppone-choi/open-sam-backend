import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import { WarUnitGeneral } from '../../../battle/WarUnitGeneral';
import type { RandUtil } from '../../../utils/RandUtil';

export class CheWiapActivateTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_POST + 700);
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    _selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    _rng: RandUtil
  ): boolean {
    if (!self.hasActivatedSkill('위압')) {
      return true;
    }

    oppose.getLogger().pushGeneralBattleDetailLog('상대에게 <R>위압</>받았다!');
    self.getLogger().pushGeneralBattleDetailLog('상대에게 <C>위압</>을 가했다!');

    oppose.setWarPowerMultiply(0);
    if (oppose instanceof WarUnitGeneral) {
      oppose.increaseVarWithLimit('atmos', -5, 40);
    }

    return true;
  }
}

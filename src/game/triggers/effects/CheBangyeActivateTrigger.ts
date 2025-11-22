import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';
import { JosaUtil } from '../../../utils/JosaUtil';

export class CheBangyeActivateTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_POST + 250);
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    selfEnv: Record<string, any>,
    opposeEnv: Record<string, any>,
    _rng: RandUtil
  ): boolean {
    if (!self.hasActivatedSkill('반계')) {
      return true;
    }

    const magicPayload = opposeEnv['magic'];
    if (!Array.isArray(magicPayload) || magicPayload.length < 2) {
      return true;
    }

    const [magicName, damage] = magicPayload as [string, number];
    if (typeof damage !== 'number') {
      return true;
    }

    const josaUl = JosaUtil.pick(magicName, '을');
    self.getLogger().pushGeneralBattleDetailLog(`상대의 ${magicName}${josaUl} <C>반계</>했다!`);
    oppose.getLogger().pushGeneralBattleDetailLog(`${magicName}${josaUl} <R>역공</>을 당했다!`);

    self.multiplyWarPowerMultiply(damage);
    return true;
  }
}

import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';

export class CheWiapAttemptTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_BEGIN + 100);
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    _selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    _rng: RandUtil
  ): boolean {
    if (self.getPhase() !== 0 && oppose.getPhase() !== 0) {
      return true;
    }
    if (self.hasActivatedSkill('위압불가')) {
      return true;
    }

    self.activateSkill('위압');
    oppose.activateSkill('회피불가', '필살불가', '계략불가');
    return true;
  }
}

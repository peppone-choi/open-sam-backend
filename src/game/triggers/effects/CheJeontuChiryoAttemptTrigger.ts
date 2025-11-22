import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';

export class CheJeontuChiryoAttemptTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_PRE + 350);
  }

  protected actionWar(
    self: WarUnit,
    _oppose: WarUnit,
    _selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    rng: RandUtil
  ): boolean {
    if (self.hasActivatedSkill('치료') || self.hasActivatedSkill('치료불가')) {
      return true;
    }
    if (!rng.nextBool(0.4)) {
      return true;
    }

    self.activateSkill('치료');
    return true;
  }
}

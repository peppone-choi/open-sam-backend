import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';

export class CheGyuknoAttemptTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_BODY + 400);
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    _selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    rng: RandUtil
  ): boolean {
    const opposeHasCritical = oppose.hasActivatedSkill('필살');
    const opposeTriedEvasion = oppose.hasActivatedSkill('회피');
    if (!opposeHasCritical && !opposeTriedEvasion) {
      return true;
    }
    if (self.hasActivatedSkill('격노불가')) {
      return true;
    }

    let triggered = false;
    if (opposeHasCritical) {
      triggered = true;
    } else if (rng.nextBool(0.25)) {
      triggered = true;
    }

    if (!triggered) {
      return true;
    }

    self.activateSkill('격노');
    oppose.deactivateSkill('회피');

    if (self.isAttackerUnit() && rng.nextBool(0.5)) {
      self.activateSkill('진노');
    }

    return true;
  }
}

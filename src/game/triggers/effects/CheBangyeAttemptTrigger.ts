import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';

export class CheBangyeAttemptTrigger extends BaseWarUnitTrigger {
  private readonly probability: number;

  constructor(unit: WarUnit, probability = 0.4) {
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_BODY + 300);
    this.probability = probability;
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    _selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    rng: RandUtil
  ): boolean {
    if (!oppose.hasActivatedSkill('계략')) {
      return true;
    }
    if (self.hasActivatedSkill('반계불가')) {
      return true;
    }
    if (!rng.nextBool(this.probability)) {
      return true;
    }

    self.activateSkill('반계');
    oppose.deactivateSkill('계략');
    return true;
  }
}

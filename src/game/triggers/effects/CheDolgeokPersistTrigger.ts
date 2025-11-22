import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import { WarUnitCity } from '../../../battle/WarUnitCity';
import { CrewType } from '../../../models/crew-type.model';
import type { RandUtil } from '../../../utils/RandUtil';

export class CheDolgeokPersistTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_POST + 900);
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    _selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    _rng: RandUtil
  ): boolean {
    if (oppose instanceof WarUnitCity) {
      return true;
    }
    if (!self.isAttackerUnit()) {
      return true;
    }

    const selfCrew = self.getCrewType();
    const opposeCrew = oppose.getCrewType();
    if (!selfCrew || !opposeCrew) {
      return true;
    }

    const attackCoef = CrewType.getAttackCoef(selfCrew.id, opposeCrew.id);
    if (attackCoef < 1) {
      if (oppose.hasActivatedSkill('선제') && self.getPhase() >= self.getMaxPhase() - 2) {
        self.addBonusPhase(-1);
      }
      return true;
    }

    if (self.getPhase() < self.getMaxPhase() - 1) {
      return true;
    }

    self.addBonusPhase(1);
    return true;
  }
}

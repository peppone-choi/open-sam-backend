/**
 * ChePilsalAttemptTrigger - 필살 시도 트리거
 * PHP: core/hwe/sammo/WarUnitTrigger/che_필살시도.php
 * 
 * 크리티컬 확률에 따라 필살 스킬을 활성화합니다.
 */

import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';
import { WarUnitGeneral } from '../../../battle/WarUnitGeneral';

export class ChePilsalAttemptTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    // PHP: PRIORITY_PRE + 120 = 20120
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_PRE + 120);
  }

  protected actionWar(
    self: WarUnit,
    _oppose: WarUnit,
    _selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    rng: RandUtil
  ): boolean {
    // PHP: if(!($self instanceof WarUnitGeneral))
    if (!(self instanceof WarUnitGeneral)) {
      return true;
    }

    // PHP: if($self->hasActivatedSkill('특수'))
    if (self.hasActivatedSkill('특수')) {
      return true;
    }

    // PHP: if($self->hasActivatedSkill('필살불가'))
    if (self.hasActivatedSkill('필살불가')) {
      return true;
    }

    // PHP: if(!$self->rng->nextBool($self->getComputedCriticalRatio()))
    const criticalRatio = self.getComputedCriticalRatio();
    if (!rng.nextBool(criticalRatio)) {
      return true;
    }

    // PHP: $self->activateSkill('필살시도', '필살')
    self.activateSkill('필살시도', '필살');

    return true;
  }
}





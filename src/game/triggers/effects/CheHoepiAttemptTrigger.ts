/**
 * CheHoepiAttemptTrigger - 회피 시도 트리거
 * PHP: core/hwe/sammo/WarUnitTrigger/che_회피시도.php
 * 
 * 회피 확률에 따라 회피 스킬을 활성화합니다.
 */

import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';
import { WarUnitGeneral } from '../../../battle/WarUnitGeneral';

export class CheHoepiAttemptTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    // PHP: PRIORITY_PRE + 200 = 20200
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_PRE + 200);
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

    // PHP: if($self->hasActivatedSkill('회피불가'))
    if (self.hasActivatedSkill('회피불가')) {
      return true;
    }

    // PHP: if(!$self->rng->nextBool($self->getComputedAvoidRatio()))
    const avoidRatio = self.getComputedAvoidRatio();
    if (!rng.nextBool(avoidRatio)) {
      return true;
    }

    // PHP: $self->activateSkill('회피시도', '회피')
    self.activateSkill('회피시도', '회피');

    return true;
  }
}


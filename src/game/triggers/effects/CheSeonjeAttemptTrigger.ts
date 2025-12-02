/**
 * CheSeonjeAttemptTrigger - 선제사격 시도 트리거
 * PHP: core/hwe/sammo/WarUnitTrigger/che_선제사격시도.php
 * 
 * 궁병 계열 병종의 선제 사격을 시도합니다.
 * 첫 페이즈에서만 발동합니다.
 */

import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';
import { WarUnitGeneral } from '../../../battle/WarUnitGeneral';

export class CheSeonjeAttemptTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    // PHP: PRIORITY_BEGIN + 50 = 10050
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_BEGIN + 50);
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    _selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    _rng: RandUtil
  ): boolean {
    // PHP: assert($self instanceof WarUnitGeneral, 'General만 발동 가능')
    if (!(self instanceof WarUnitGeneral)) {
      return true;
    }

    // PHP: if ($self->getPhase() !== 0 && $oppose->getPhase() !== 0)
    // 첫 페이즈에서만 발동
    if (self.getPhase() !== 0 && oppose.getPhase() !== 0) {
      return true;
    }

    // PHP: if ($self->hasActivatedSkill('선제'))
    if (self.hasActivatedSkill('선제')) {
      return true;
    }

    // PHP: if ($self->hasActivatedSkillOnLog('선제'))
    if (self.hasActivatedSkillOnLog('선제')) {
      return true;
    }

    // PHP: $self->activateSkill('특수', '선제')
    self.activateSkill('특수', '선제');

    return true;
  }
}





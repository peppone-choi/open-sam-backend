/**
 * 저지시도 트리거
 * PHP: che_저지시도.php
 */
import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';
import { WarUnitGeneral } from '../../../battle/WarUnitGeneral';

export class CheJeojiAttemptTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_PRE); // 최우선 순위
  }

  protected actionWar(
    self: WarUnit,
    _oppose: WarUnit,
    _selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    rng: RandUtil
  ): boolean {
    if (!(self instanceof WarUnitGeneral)) {
      return true;
    }
    // 수비자만 저지 가능
    if (self.isAttackerUnit()) {
      return true;
    }
    if (self.hasActivatedSkill('특수')) {
      return true;
    }
    if (self.hasActivatedSkill('저지불가')) {
      return true;
    }

    const ratio = self.getComputedAtmos() + self.getComputedTrain();
    if (rng.nextBool(ratio / 400)) {
      self.activateSkill('특수', '저지');
    }

    return true;
  }
}


/**
 * 퇴각부상무효 트리거
 * PHP: che_퇴각부상무효.php
 * 퇴각 시 부상을 입지 않음
 */
import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';
import { WarUnitGeneral } from '../../../battle/WarUnitGeneral';

export class CheTwoegakBusangMuhyoTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_BEGIN + 300);
  }

  protected actionWar(
    self: WarUnit,
    _oppose: WarUnit,
    _selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    _rng: RandUtil
  ): boolean {
    if (!(self instanceof WarUnitGeneral)) {
      return true;
    }

    self.activateSkill('퇴각부상무효');

    return true;
  }
}





/**
 * 성벽부상무효 트리거
 * PHP: che_성벽부상무효.php
 * 성벽 공격 시 부상을 입지 않음
 */
import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';
import { WarUnitGeneral } from '../../../battle/WarUnitGeneral';
import { WarUnitCity } from '../../../battle/WarUnitCity';

export class CheSungbyokBusangMuhyoTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_BEGIN + 150);
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    _selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    _rng: RandUtil
  ): boolean {
    if (!(self instanceof WarUnitGeneral)) {
      return true;
    }
    // 상대가 성이 아니면 적용하지 않음
    if (!(oppose instanceof WarUnitCity)) {
      return true;
    }

    self.activateSkill('부상무효');

    return true;
  }
}


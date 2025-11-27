/**
 * 방어력증가5p 트리거
 * PHP: che_방어력증가5p.php
 * 수비 시 상대의 warPowerMultiply를 1/1.05 배로 감소
 */
import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';

export class CheBangeoIncrease5pTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_FINAL + 200); // 최후미
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    _selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    _rng: RandUtil
  ): boolean {
    // 수비자일 때만 적용
    if (!self.isAttackerUnit()) {
      oppose.multiplyWarPowerMultiply(1 / 1.05);
    }

    return true;
  }
}


/**
 * 기병병종전투 트리거
 * PHP: che_기병병종전투.php
 * 기병의 공격/수비 시 전투력 보정
 */
import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';
import { WarUnitCity } from '../../../battle/WarUnitCity';

export class CheGibyongCombatTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_FINAL + 100); // 최후미
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    _selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    _rng: RandUtil
  ): boolean {
    if (!self.isAttackerUnit()) {
      // 수비 시: 상대 공격력 증가, 내 공격력 감소
      oppose.multiplyWarPowerMultiply(1.02);
      self.multiplyWarPowerMultiply(0.97);
    } else if (oppose instanceof WarUnitCity) {
      // 성 공격 시: 공격력 감소
      self.multiplyWarPowerMultiply(0.9);
    } else {
      // 일반 공격 시: 상대 공격력 감소, 내 공격력 증가
      oppose.multiplyWarPowerMultiply(0.97);
      self.multiplyWarPowerMultiply(1.02);
    }

    return true;
  }
}


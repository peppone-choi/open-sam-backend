/**
 * 전투력보정 트리거
 * PHP: 전투력보정.php
 * 공격자/수비자의 전투력에 배수 적용
 */
import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';

export class JeonturyokBojeongTrigger extends BaseWarUnitTrigger {
  private attackerWarPowerMultiplier: number;
  private defenderWarPowerMultiplier: number;

  constructor(
    unit: WarUnit,
    attackerWarPowerMultiplier: number,
    defenderWarPowerMultiplier: number = 1
  ) {
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_BEGIN + 20);
    this.attackerWarPowerMultiplier = attackerWarPowerMultiplier;
    this.defenderWarPowerMultiplier = defenderWarPowerMultiplier;
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    _selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    _rng: RandUtil
  ): boolean {
    self.multiplyWarPowerMultiply(this.attackerWarPowerMultiplier);
    oppose.multiplyWarPowerMultiply(this.defenderWarPowerMultiplier);

    this.processConsumableItem();

    return true;
  }
}





/**
 * 이벤트 필살 특기
 * PHP 대응: che_event_필살.php
 */

import { BaseSpecialDomestic } from '../../BaseSpecialDomestic';
import type { WarUnit } from '../../../../battle/WarUnit';
import { WarUnitTriggerCaller } from '../../../triggers/WarUnitTriggerCaller';
import { ChePilsalNoEvasionTrigger } from '../../../triggers/effects/ChePilsalNoEvasionTrigger';

export class CheEventPilsalSpecialDomestic extends BaseSpecialDomestic {
  get id(): string {
    return 'che_event_필살';
  }

  getName(): string {
    return '필살';
  }

  getInfo(): string {
    return '[전투] 필살 확률 +30%p, 필살 발동시 회피 불가';
  }

  override onCalcStat(_general: any, statName: string, value: number): number {
    if (statName === 'warCriticalRatio') {
      return value + 0.30;
    }
    if (statName === 'criticalDamageRange') {
      const [rangeMin, rangeMax] = value as unknown as [number, number];
      return [(rangeMin + rangeMax) / 2, rangeMax] as unknown as number;
    }
    return value;
  }

  override getBattlePhaseSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null {
    return new WarUnitTriggerCaller(
      new ChePilsalNoEvasionTrigger(unit)
    );
  }
}

/**
 * 이벤트 격노 특기 (내정 → 전투 특기 획득)
 * PHP 대응: che_event_격노.php
 */

import { BaseSpecialDomestic } from '../../BaseSpecialDomestic';
import type { WarUnit } from '../../../../battle/WarUnit';
import { WarUnitTriggerCaller } from '../../../triggers/WarUnitTriggerCaller';
import { CheGyuknoAttemptTrigger } from '../../../triggers/effects/CheGyuknoAttemptTrigger';
import { CheGyuknoActivateTrigger } from '../../../triggers/effects/CheGyuknoActivateTrigger';

export class CheEventGyuknoSpecialDomestic extends BaseSpecialDomestic {
  get id(): string {
    return 'che_event_격노';
  }

  getName(): string {
    return '격노';
  }

  getInfo(): string {
    return '[전투] 상대 필살·회피에 반응하여 격노 발동, 진노 시 페이즈 추가';
  }

  override getWarPowerMultiplier(unit: WarUnit): [number, number] {
    const activatedCnt = unit.hasActivatedSkillOnLog?.('격노') ?? 0;
    return [1 + 0.2 * activatedCnt, 1];
  }

  override getBattlePhaseSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null {
    return new WarUnitTriggerCaller(
      new CheGyuknoAttemptTrigger(unit),
      new CheGyuknoActivateTrigger(unit)
    );
  }
}

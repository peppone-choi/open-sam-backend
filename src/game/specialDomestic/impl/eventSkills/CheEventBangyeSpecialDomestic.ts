/**
 * 이벤트 반계 특기
 * PHP 대응: che_event_반계.php
 */

import { BaseSpecialDomestic } from '../../BaseSpecialDomestic';
import type { WarUnit } from '../../../../battle/WarUnit';
import { WarUnitTriggerCaller } from '../../../triggers/WarUnitTriggerCaller';
import { CheBangyeAttemptTrigger } from '../../../triggers/effects/CheBangyeAttemptTrigger';
import { CheBangyeActivateTrigger } from '../../../triggers/effects/CheBangyeActivateTrigger';

export class CheEventBangyeSpecialDomestic extends BaseSpecialDomestic {
  get id(): string {
    return 'che_event_반계';
  }

  getName(): string {
    return '반계';
  }

  getInfo(): string {
    return '[전투] 상대 계략 성공 확률 -10%p, 40% 확률로 계략 반사';
  }

  override onCalcStat(_general: any, statName: string, value: number, aux?: any): number {
    if (statName === 'warMagicSuccessDamage' && aux === '반목') {
      return value + 0.9;
    }
    return value;
  }

  override onCalcOpposeStat(_general: any, statName: string, value: number): number {
    if (statName === 'warMagicSuccessProb') {
      return value - 0.1;
    }
    return value;
  }

  override getBattlePhaseSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null {
    return new WarUnitTriggerCaller(
      new CheBangyeAttemptTrigger(unit),
      new CheBangyeActivateTrigger(unit)
    );
  }
}

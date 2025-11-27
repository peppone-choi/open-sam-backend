/**
 * ChePilsalActivateTrigger - 필살 발동 트리거
 * PHP: core/hwe/sammo/WarUnitTrigger/che_필살발동.php
 * 
 * 필살 스킬이 활성화된 경우 크리티컬 데미지를 적용합니다.
 */

import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';

export class ChePilsalActivateTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    // PHP: PRIORITY_POST + 400 = 40400
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_POST + 400);
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    _rng: RandUtil
  ): boolean {
    // PHP: if(!$self->hasActivatedSkill('필살'))
    if (!self.hasActivatedSkill('필살')) {
      return true;
    }

    // PHP: if($selfEnv['필살발동']??false)
    if (selfEnv['필살발동']) {
      return true;
    }
    selfEnv['필살발동'] = true;

    // PHP: 로그 출력
    try {
      const opposeLogger = oppose.getLogger?.();
      const selfLogger = self.getLogger?.();
      
      if (opposeLogger?.pushGeneralBattleDetailLog) {
        opposeLogger.pushGeneralBattleDetailLog("상대의 <R>필살</>공격!</>", 1);
      }
      if (selfLogger?.pushGeneralBattleDetailLog) {
        selfLogger.pushGeneralBattleDetailLog("<C>필살</>공격!</>", 1);
      }
    } catch {
      // 로거 없을 수 있음
    }

    // PHP: $self->multiplyWarPowerMultiply($self->criticalDamage())
    const criticalDamage = self.criticalDamage();
    self.multiplyWarPowerMultiply(criticalDamage);

    return true;
  }
}


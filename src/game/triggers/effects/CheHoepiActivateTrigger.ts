/**
 * CheHoepiActivateTrigger - 회피 발동 트리거
 * PHP: core/hwe/sammo/WarUnitTrigger/che_회피발동.php
 * 
 * 회피 스킬이 활성화된 경우 상대의 전투력을 1/6로 감소시킵니다.
 */

import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';

export class CheHoepiActivateTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    // PHP: PRIORITY_POST + 500 = 40500
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_POST + 500);
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    _selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    _rng: RandUtil
  ): boolean {
    // PHP: if(!$self->hasActivatedSkill('회피'))
    if (!self.hasActivatedSkill('회피')) {
      return true;
    }

    // PHP: 로그 출력
    try {
      const opposeLogger = oppose.getLogger?.();
      const selfLogger = self.getLogger?.();
      
      if (opposeLogger?.pushGeneralBattleDetailLog) {
        opposeLogger.pushGeneralBattleDetailLog("상대가 <R>회피</>했다!</>", 1);
      }
      if (selfLogger?.pushGeneralBattleDetailLog) {
        selfLogger.pushGeneralBattleDetailLog("<C>회피</>했다!</>", 1);
      }
    } catch {
      // 로거 없을 수 있음
    }

    // PHP: $oppose->multiplyWarPowerMultiply(1/6)
    // 상대의 전투력을 1/6로 감소
    oppose.multiplyWarPowerMultiply(1 / 6);

    return true;
  }
}


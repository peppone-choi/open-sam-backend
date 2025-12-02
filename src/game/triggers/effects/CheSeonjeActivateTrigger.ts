/**
 * CheSeonjeActivateTrigger - 선제사격 발동 트리거
 * PHP: core/hwe/sammo/WarUnitTrigger/che_선제사격발동.php
 * 
 * 선제 스킬이 활성화된 경우 선제 사격을 발동합니다.
 * - 맞선제: 양쪽 전투력 2/3
 * - 일방 선제: 상대 전투력 0, 자신 전투력 2/3
 */

import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';
import { WarUnitGeneral } from '../../../battle/WarUnitGeneral';

export class CheSeonjeActivateTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    // PHP: PRIORITY_BEGIN + 51 = 10051
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_BEGIN + 51);
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    _selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    _rng: RandUtil
  ): boolean {
    // PHP: assert($self instanceof WarUnitGeneral, 'General만 발동 가능')
    if (!(self instanceof WarUnitGeneral)) {
      return true;
    }

    // PHP: if (!$self->hasActivatedSkill('선제'))
    if (!self.hasActivatedSkill('선제')) {
      return true;
    }

    // PHP: if ($oppose->hasActivatedSkill('선제') && $oppose->isAttacker())
    // 맞선제라면 공격자가 처리
    if (oppose.hasActivatedSkill('선제') && oppose.isAttackerUnit()) {
      return true;
    }

    // PHP: $self->addPhase(-1); $oppose->addPhase(-1);
    self.addPhase(-1);
    oppose.addPhase(-1);

    // 맞선제 처리
    if (oppose.hasActivatedSkill('선제')) {
      // PHP: $self->multiplyWarPowerMultiply(2/3);
      // PHP: $oppose->multiplyWarPowerMultiply(2/3);
      self.multiplyWarPowerMultiply(2 / 3);
      oppose.multiplyWarPowerMultiply(2 / 3);

      // PHP: 로그 출력
      try {
        const opposeLogger = oppose.getLogger?.();
        const selfLogger = self.getLogger?.();
        
        if (opposeLogger?.pushGeneralBattleDetailLog) {
          opposeLogger.pushGeneralBattleDetailLog('서로 <C>선제 사격</>을 주고 받았다!</>', 1);
        }
        if (selfLogger?.pushGeneralBattleDetailLog) {
          selfLogger.pushGeneralBattleDetailLog('서로 <C>선제 사격</>을 주고 받았다!</>', 1);
        }
      } catch {
        // 로거 없을 수 있음
      }

      return true;
    }

    // 일방 선제 사격
    // PHP: $oppose->multiplyWarPowerMultiply(0);
    // PHP: $self->multiplyWarPowerMultiply(2/3);
    oppose.multiplyWarPowerMultiply(0);
    self.multiplyWarPowerMultiply(2 / 3);

    // PHP: $self->activateSkill('회피불가', '필살불가', '계략불가');
    self.activateSkill('회피불가', '필살불가', '계략불가');
    
    // PHP: $oppose->activateSkill('회피불가', '필살불가', '격노불가', '계략불가');
    oppose.activateSkill('회피불가', '필살불가', '격노불가', '계략불가');

    // PHP: 로그 출력
    try {
      const opposeLogger = oppose.getLogger?.();
      const selfLogger = self.getLogger?.();
      
      if (opposeLogger?.pushGeneralBattleDetailLog) {
        opposeLogger.pushGeneralBattleDetailLog('상대에게 <R>선제 사격</>을 받았다!</>', 1);
      }
      if (selfLogger?.pushGeneralBattleDetailLog) {
        selfLogger.pushGeneralBattleDetailLog('상대에게 <C>선제 사격</>을 했다!</>', 1);
      }
    } catch {
      // 로거 없을 수 있음
    }

    return true;
  }
}





/**
 * 충차아이템소모 트리거
 * PHP: event_충차아이템소모.php
 * 충차 아이템 사용 시 소모 처리
 */
import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';
import { ActionLogger } from '../../../utils/ActionLogger';
import { WarUnitGeneral } from '../../../battle/WarUnitGeneral';
import { WarUnitCity } from '../../../battle/WarUnitCity';

const CHUNGCHA_REMAIN_KEY = 'chungcha_remain';

export class EventChungchaSomoTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_PRE + 200);
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    _selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    _rng: RandUtil
  ): boolean {
    // 이미 충차 공격 중이고 마지막 페이즈라면 소모 처리
    if (self.hasActivatedSkillOnLog('충차공격') && self.getPhase() === self.getMaxPhase() - 1) {
      const general = self.getGeneral();
      const remain = general.getAuxVar?.(CHUNGCHA_REMAIN_KEY) ?? 0;
      if (remain <= 0) {
        this.processConsumableItem();
      }
      return true;
    }

    if (!(self instanceof WarUnitGeneral)) {
      return true;
    }
    if (!(oppose instanceof WarUnitCity)) {
      return true;
    }
    if (self.hasActivatedSkillOnLog('충차공격')) {
      return true;
    }

    self.getLogger()?.pushGeneralBattleDetailLog?.('<C>충차</>로 성벽을 공격합니다.', ActionLogger.PLAIN);

    const general = self.getGeneral();
    const remain = general.getAuxVar?.(CHUNGCHA_REMAIN_KEY) ?? 0;
    self.activateSkill('충차공격');
    if (typeof general.setAuxVar === 'function') {
      general.setAuxVar(CHUNGCHA_REMAIN_KEY, remain - 1);
    }

    return true;
  }
}


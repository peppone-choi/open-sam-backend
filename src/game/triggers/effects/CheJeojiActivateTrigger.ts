/**
 * 저지발동 트리거
 * PHP: che_저지발동.php
 */
import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';
import { ActionLogger } from '../../../utils/ActionLogger';
import { WarUnitGeneral } from '../../../battle/WarUnitGeneral';

export class CheJeojiActivateTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_POST); // 최우선 순위
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    _rng: RandUtil
  ): boolean {
    if (!self.hasActivatedSkill('저지')) {
      return true;
    }

    if (selfEnv['저지발동'] ?? false) {
      return true;
    }
    selfEnv['저지발동'] = true;

    // 페이즈 감소
    self.addPhase(-1);
    oppose.addPhase(-1);
    if (self.getPhase() < self.getMaxPhase()) {
      oppose.addBonusPhase(-1);
    }

    // 로그 출력
    self.getLogger()?.pushGeneralBattleDetailLog?.('상대를 <C>저지</>했다!', ActionLogger.PLAIN);
    oppose.getLogger()?.pushGeneralBattleDetailLog?.('저지</>당했다!', ActionLogger.PLAIN);

    // 경험치 및 숙련도 계산
    const calcDamage = oppose.getWarPower() * 0.9;
    const general = self.getGeneral();

    // 숙련도 추가
    if (typeof general.addDex === 'function') {
      general.addDex(oppose.getCrewType(), oppose.getWarPower() * 0.9);
      general.addDex(self.getCrewType(), calcDamage);
    }

    // 경험치 및 쌀 소모
    if (self instanceof WarUnitGeneral) {
      if (typeof self.addLevelExp === 'function') {
        self.addLevelExp(calcDamage / 50);
      }
      const rice = self.calcRiceConsumption(calcDamage) * 0.25;
      if (typeof general.increaseVarWithLimit === 'function') {
        general.increaseVarWithLimit('rice', -rice, 0);
      } else if (general.data) {
        general.data.rice = Math.max(0, (general.data.rice || 0) - rice);
      }
    }

    // 저지는 양측 모두 데미지 0
    self.setWarPowerMultiply(0);
    oppose.setWarPowerMultiply(0);

    return false; // 저지는 모든 이벤트를 중지시킨다.
  }
}


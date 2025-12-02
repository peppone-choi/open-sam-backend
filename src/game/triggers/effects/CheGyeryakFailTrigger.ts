/**
 * CheGyeryakFailTrigger - 계략 실패 트리거
 * PHP: core/hwe/sammo/WarUnitTrigger/che_계략실패.php
 * 
 * 계략이 실패한 경우 자신의 전투력 감소, 상대 전투력 증가를 적용합니다.
 */

import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';
import { JosaUtil } from '../../../utils/JosaUtil';

export class CheGyeryakFailTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    // PHP: PRIORITY_POST + 300 = 40300
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_POST + 300);
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    _rng: RandUtil
  ): boolean {
    // PHP: if(!$self->hasActivatedSkill('계략실패'))
    if (!self.hasActivatedSkill('계략실패')) {
      return true;
    }

    // PHP: if($selfEnv['계략실패']??false)
    if (selfEnv['계략실패']) {
      return true;
    }
    selfEnv['계략실패'] = true;

    const general = self.getGeneral();
    const opposeGeneral = oppose.getGeneral?.();

    // PHP: [$magic, $damage] = $selfEnv['magic']
    const [magic, damage] = selfEnv['magic'] as [string, number];

    // 데미지 보정
    let finalDamage = damage;
    if (general && typeof general.onCalcStat === 'function') {
      finalDamage = general.onCalcStat(general, 'warMagicFailDamage', finalDamage, magic);
    }
    if (opposeGeneral && typeof opposeGeneral.onCalcOpposeStat === 'function') {
      finalDamage = opposeGeneral.onCalcOpposeStat(general, 'warMagicFailDamage', finalDamage, magic);
    }

    // 로그 출력
    const josaUl = JosaUtil.pick(magic, '을');
    
    try {
      const selfLogger = self.getLogger?.();
      const opposeLogger = oppose.getLogger?.();
      
      if (selfLogger?.pushGeneralBattleDetailLog) {
        selfLogger.pushGeneralBattleDetailLog(`<D>${magic}</>${josaUl} <R>실패</>했다!`, 1);
      }
      if (opposeLogger?.pushGeneralBattleDetailLog) {
        opposeLogger.pushGeneralBattleDetailLog(`<D>${magic}</>${josaUl} 간파했다!`, 1);
      }
    } catch {
      // 로거 없을 수 있음
    }

    // PHP: $self->multiplyWarPowerMultiply(1/$damage)
    // PHP: $oppose->multiplyWarPowerMultiply($damage)
    self.multiplyWarPowerMultiply(1 / finalDamage);
    oppose.multiplyWarPowerMultiply(finalDamage);

    return true;
  }
}





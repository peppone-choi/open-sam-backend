/**
 * 약탈발동 트리거
 * PHP: che_약탈발동.php
 */
import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';
import { ActionLogger } from '../../../utils/ActionLogger';
import { WarUnitGeneral } from '../../../battle/WarUnitGeneral';

export class CheYaktalActivateTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_POST + 350);
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    _rng: RandUtil
  ): boolean {
    if (!self.hasActivatedSkill('약탈')) {
      return true;
    }

    if (selfEnv['약탈발동'] ?? false) {
      return true;
    }
    selfEnv['약탈발동'] = true;

    const general = self.getGeneral();

    if (!(oppose instanceof WarUnitGeneral)) {
      return true;
    }

    const opposeGeneral = oppose.getGeneral();
    const theftRatio = selfEnv['theftRatio'] ?? 0;

    const opposeGold = opposeGeneral.getVar?.('gold') ?? opposeGeneral.data?.gold ?? 0;
    const opposeRice = opposeGeneral.getVar?.('rice') ?? opposeGeneral.data?.rice ?? 0;

    const theftGold = Math.floor(opposeGold * theftRatio);
    const theftRice = Math.floor(opposeRice * theftRatio);

    // 상대 자원 감소
    if (typeof opposeGeneral.increaseVarWithLimit === 'function') {
      opposeGeneral.increaseVarWithLimit('gold', -theftGold, 0);
      opposeGeneral.increaseVarWithLimit('rice', -theftRice, 0);
    } else if (opposeGeneral.data) {
      opposeGeneral.data.gold = Math.max(0, (opposeGeneral.data.gold || 0) - theftGold);
      opposeGeneral.data.rice = Math.max(0, (opposeGeneral.data.rice || 0) - theftRice);
    }

    // 내 자원 증가
    if (typeof general.increaseVar === 'function') {
      general.increaseVar('gold', theftGold);
      general.increaseVar('rice', theftRice);
    } else if (general.data) {
      general.data.gold = (general.data.gold || 0) + theftGold;
      general.data.rice = (general.data.rice || 0) + theftRice;
    }

    // 로그 출력
    self.getLogger()?.pushGeneralActionLog?.('상대를 <C>약탈</>했다!', ActionLogger.PLAIN);
    self.getLogger()?.pushGeneralBattleDetailLog?.(
      `상대에게서 금 ${theftGold}, 쌀 ${theftRice} 만큼을 <C>약탈</>했다!`,
      ActionLogger.PLAIN
    );
    oppose.getLogger()?.pushGeneralActionLog?.('상대에게 <R>약탈</>당했다!', ActionLogger.PLAIN);
    oppose.getLogger()?.pushGeneralBattleDetailLog?.(
      `상대에게 금 ${theftGold}, 쌀 ${theftRice} 만큼을 <R>약탈</>당했다!`,
      ActionLogger.PLAIN
    );

    this.processConsumableItem();

    return true;
  }
}





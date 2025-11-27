/**
 * 전멸시페이즈증가 트리거
 * PHP: che_전멸시페이즈증가.php
 * 상대 전멸 시 추가 페이즈 획득
 */
import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';
import { ActionLogger } from '../../../utils/ActionLogger';

export class CheJunmyolPhaseIncreaseTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_POST + 800);
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    _selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    _rng: RandUtil
  ): boolean {
    // 내가 살아있고 상대가 전멸(phase === 0)이면 추가 페이즈
    if (self.getPhase() !== 0 && oppose.getPhase() === 0) {
      self.addBonusPhase(1);
      self.getLogger()?.pushGeneralBattleDetailLog?.(
        '적군의 전멸에 <C>진격</>이 이어집니다!',
        ActionLogger.PLAIN
      );
      oppose.getLogger()?.pushGeneralBattleDetailLog?.(
        '아군의 전멸에 상대의 <R>진격</>이 이어집니다!',
        ActionLogger.PLAIN
      );
    }

    return true;
  }
}


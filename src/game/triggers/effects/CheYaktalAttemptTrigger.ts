/**
 * 약탈시도 트리거
 * PHP: che_약탈시도.php
 */
import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';
import { WarUnitGeneral } from '../../../battle/WarUnitGeneral';

export class CheYaktalAttemptTrigger extends BaseWarUnitTrigger {
  private ratio: number;
  private theftRatio: number;

  constructor(unit: WarUnit, raiseType: number, ratio: number, theftRatio: number) {
    super(unit, raiseType, ObjectTrigger.PRIORITY_PRE + 400);
    this.ratio = ratio;
    this.theftRatio = theftRatio;
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    rng: RandUtil
  ): boolean {
    if (!(self instanceof WarUnitGeneral)) {
      return true;
    }
    // 첫 페이즈에서만 발동
    if (self.getPhase() !== 0 && oppose.getPhase() !== 0) {
      return true;
    }
    // 상대가 장군이 아니면 약탈 불가
    if (!(oppose instanceof WarUnitGeneral)) {
      return true;
    }
    if (self.hasActivatedSkill('약탈')) {
      return true;
    }
    if (self.hasActivatedSkill('약탈불가')) {
      return true;
    }
    if (!rng.nextBool(this.ratio)) {
      return true;
    }

    self.activateSkill('약탈');
    selfEnv['theftRatio'] = this.theftRatio;

    return true;
  }
}





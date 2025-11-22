import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';

export class CheJeogyeokAttemptTrigger extends BaseWarUnitTrigger {
  private readonly ratio: number;
  private readonly woundMin: number;
  private readonly woundMax: number;
  private readonly addAtmos: number;

  constructor(unit: WarUnit, ratio: number, woundMin: number, woundMax: number, addAtmos = 20) {
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_PRE + 100);
    this.ratio = ratio;
    this.woundMin = woundMin;
    this.woundMax = woundMax;
    this.addAtmos = addAtmos;
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    rng: RandUtil
  ): boolean {
    if (self.getPhase() !== 0 && oppose.getPhase() !== 0) {
      return true;
    }
    if (oppose.getPhase() < 0) {
      return true;
    }
    if (self.hasActivatedSkill('저격') || self.hasActivatedSkill('저격불가')) {
      return true;
    }
    if (!rng.nextBool(this.ratio)) {
      return true;
    }

    self.activateSkill('저격');
    selfEnv.snipingCaster = this.raiseType;
    selfEnv.snipingWoundMin = this.woundMin;
    selfEnv.snipingWoundMax = this.woundMax;
    selfEnv.snipingAddAtmos = this.addAtmos;
    return true;
  }
}

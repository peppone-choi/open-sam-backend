import { WarUnit } from '../../battle/WarUnit';
import { RandUtil } from '../../utils/RandUtil';
import { ObjectTrigger } from './ObjectTrigger';
import { TriggerEnv, ensureTriggerEnv } from './TriggerEnv';

export abstract class BaseWarUnitTrigger<TArg = [WarUnit, WarUnit]> extends ObjectTrigger<TArg> {
  static readonly TYPE_NONE = 0;
  static readonly TYPE_ITEM = 1;
  static readonly TYPE_CONSUMABLE_ITEM = BaseWarUnitTrigger.TYPE_ITEM | 2;
  static readonly TYPE_DEDUP_TYPE_BASE = 1024;

  protected object: WarUnit;
  protected raiseType: number;

  constructor(unit: WarUnit, raiseType: number = BaseWarUnitTrigger.TYPE_NONE, priority?: number) {
    super(priority ?? ObjectTrigger.PRIORITY_BODY);
    this.object = unit;
    this.raiseType = raiseType;
  }

  getUnit(): WarUnit {
    return this.object;
  }

  action(rng: RandUtil, env?: TriggerEnv, arg?: any): TriggerEnv {
    const normalized = ensureTriggerEnv(env);
    if (normalized.stopNextAction) {
      return normalized;
    }

    const [attacker, defender] = (arg as [WarUnit, WarUnit]) ?? [];
    if (!attacker || !defender) {
      return normalized;
    }

    const self = this.object;
    const oppose = self?.isAttackerUnit() ? defender : attacker;
    if (!self || !oppose) {
      return normalized;
    }

    const selfEnv = self.isAttackerUnit() ? normalized.e_attacker : normalized.e_defender;
    const opposeEnv = self.isAttackerUnit() ? normalized.e_defender : normalized.e_attacker;

    const callNext = this.actionWar(self, oppose, selfEnv, opposeEnv, rng);

    if (!callNext) {
      normalized.stopNextAction = true;
    }

    return normalized;
  }

  protected abstract actionWar(self: WarUnit, oppose: WarUnit, selfEnv: Record<string, any>, opposeEnv: Record<string, any>, rng: RandUtil): boolean;

  protected processConsumableItem(): boolean {
    // 아이템 소비 로직은 추후 구현 (현재는 비활성)
    return false;
  }
}

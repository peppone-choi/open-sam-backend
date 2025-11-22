import { RandUtil } from '../../utils/RandUtil';
import { TriggerEnv, ensureTriggerEnv } from './TriggerEnv';

let triggerSequence = 0;

export abstract class ObjectTrigger<TArg = any> {
  static readonly PRIORITY_MIN = 0;
  static readonly PRIORITY_BEGIN = 10000;
  static readonly PRIORITY_PRE = 20000;
  static readonly PRIORITY_BODY = 30000;
  static readonly PRIORITY_POST = 40000;
  static readonly PRIORITY_FINAL = 50000;

  protected priority: number;
  private uniqueId?: string;

  constructor(priority: number = ObjectTrigger.PRIORITY_BODY) {
    this.priority = priority;
  }

  getPriority(): number {
    return this.priority;
  }

  setPriority(newPriority: number): this {
    this.priority = newPriority;
    this.uniqueId = undefined;
    return this;
  }

  getUniqueId(): string {
    if (!this.uniqueId) {
      this.uniqueId = `${this.priority}_${this.constructor.name}_${triggerSequence += 1}`;
    }
    return this.uniqueId;
  }

  abstract action(rng: RandUtil, env?: TriggerEnv, arg?: TArg): TriggerEnv;

  protected ensureEnv(env?: TriggerEnv): TriggerEnv {
    return ensureTriggerEnv(env);
  }
}

import { RandUtil } from '../../utils/RandUtil';
import { ObjectTrigger } from './ObjectTrigger';
import { TriggerEnv, ensureTriggerEnv } from './TriggerEnv';

export abstract class TriggerCaller<TTrigger extends ObjectTrigger = ObjectTrigger> {
  protected triggerMap: Map<number, Map<string, TTrigger>> = new Map();

  protected abstract checkValidTrigger(trigger: TTrigger): boolean;

  constructor(...triggers: TTrigger[]) {
    if (triggers.length) {
      for (const trigger of triggers) {
        this.append(trigger);
      }
    }
  }

  isEmpty(): boolean {
    return this.triggerMap.size === 0;
  }

  append(trigger: TTrigger): this {
    if (!this.checkValidTrigger(trigger)) {
      throw new Error('Invalid trigger type');
    }

    const priority = trigger.getPriority();
    const uniqueId = trigger.getUniqueId();
    const existing = this.triggerMap.get(priority);
    if (existing) {
      existing.set(uniqueId, trigger);
    } else {
      this.triggerMap.set(priority, new Map([[uniqueId, trigger]]));
    }
    return this;
  }

  merge(other?: TriggerCaller<TTrigger> | null): this {
    if (!other || other.isEmpty()) {
      return this;
    }

    for (const [priority, triggerList] of other.triggerMap.entries()) {
      if (!this.triggerMap.has(priority)) {
        this.triggerMap.set(priority, new Map(triggerList));
        continue;
      }
      const target = this.triggerMap.get(priority)!;
      for (const [uniqueId, trigger] of triggerList.entries()) {
        target.set(uniqueId, trigger);
      }
    }

    return this;
  }

  fire(rng: RandUtil, env?: TriggerEnv, arg?: any): TriggerEnv {
    let currentEnv = ensureTriggerEnv(env);
    if (this.isEmpty()) {
      return currentEnv;
    }

    const sortedPriorities = Array.from(this.triggerMap.keys()).sort((a, b) => a - b);
    for (const priority of sortedPriorities) {
      const triggers = this.triggerMap.get(priority);
      if (!triggers) continue;

      for (const trigger of triggers.values()) {
        currentEnv = trigger.action(rng, currentEnv, arg);
        if (currentEnv.stopNextAction) {
          return currentEnv;
        }
      }
    }

    return currentEnv;
  }
}

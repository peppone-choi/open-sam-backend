import { BaseWarUnitTrigger } from './BaseWarUnitTrigger';
import { TriggerCaller } from './TriggerCaller';

export class WarUnitTriggerCaller extends TriggerCaller<BaseWarUnitTrigger> {
  protected checkValidTrigger(trigger: BaseWarUnitTrigger): boolean {
    return trigger instanceof BaseWarUnitTrigger;
  }

  static mergeCallers(callers: Array<WarUnitTriggerCaller | null | undefined>): WarUnitTriggerCaller | null {
    const validCallers = callers.filter((caller): caller is WarUnitTriggerCaller => !!caller && !caller.isEmpty());
    if (!validCallers.length) {
      return null;
    }
    const [head, ...rest] = validCallers;
    for (const caller of rest) {
      head.merge(caller);
    }
    return head;
  }
}

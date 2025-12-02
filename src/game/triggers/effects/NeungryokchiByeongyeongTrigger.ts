/**
 * 능력치변경 트리거
 * PHP: 능력치변경.php
 * 전투 시 장군의 능력치를 변경
 */
import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';
import { WarUnitGeneral } from '../../../battle/WarUnitGeneral';

type Operator = '=' | '+' | '-' | '*' | '/';

export class NeungryokchiByeongyeongTrigger extends BaseWarUnitTrigger {
  private variable: string;
  private operator: Operator;
  private value: number;
  private limitMin: number | null;
  private limitMax: number | null;

  constructor(
    unit: WarUnit,
    raiseType: number,
    variable: string,
    operator: Operator,
    value: number,
    limitMin: number | null = null,
    limitMax: number | null = null
  ) {
    super(unit, raiseType, ObjectTrigger.PRIORITY_BEGIN + 10);
    this.variable = variable;
    this.operator = operator;
    this.value = value;
    this.limitMin = limitMin;
    this.limitMax = limitMax;

    if (!['=', '+', '-', '*', '/'].includes(operator)) {
      throw new Error(`올바르지 않은 operator : ${operator}`);
    }
  }

  protected actionWar(
    self: WarUnit,
    _oppose: WarUnit,
    _selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    _rng: RandUtil
  ): boolean {
    if (!(self instanceof WarUnitGeneral)) {
      return true;
    }

    const general = self.getGeneral();

    if (this.operator === '=') {
      if (typeof general.setVar === 'function') {
        general.setVar(this.variable, this.value);
      } else if (general.data) {
        (general.data as Record<string, any>)[this.variable] = this.value;
      }
    } else if (this.operator === '+') {
      if (typeof general.increaseVarWithLimit === 'function') {
        general.increaseVarWithLimit(this.variable, this.value, this.limitMin, this.limitMax);
      } else if (general.data) {
        let val = ((general.data as Record<string, any>)[this.variable] || 0) + this.value;
        if (this.limitMin !== null) val = Math.max(this.limitMin, val);
        if (this.limitMax !== null) val = Math.min(this.limitMax, val);
        (general.data as Record<string, any>)[this.variable] = val;
      }
    } else if (this.operator === '-') {
      if (typeof general.increaseVarWithLimit === 'function') {
        general.increaseVarWithLimit(this.variable, -this.value, this.limitMin, this.limitMax);
      } else if (general.data) {
        let val = ((general.data as Record<string, any>)[this.variable] || 0) - this.value;
        if (this.limitMin !== null) val = Math.max(this.limitMin, val);
        if (this.limitMax !== null) val = Math.min(this.limitMax, val);
        (general.data as Record<string, any>)[this.variable] = val;
      }
    } else if (this.operator === '*') {
      if (typeof general.multiplyVarWithLimit === 'function') {
        general.multiplyVarWithLimit(this.variable, this.value, this.limitMin, this.limitMax);
      } else if (general.data) {
        let val = ((general.data as Record<string, any>)[this.variable] || 0) * this.value;
        if (this.limitMin !== null) val = Math.max(this.limitMin, val);
        if (this.limitMax !== null) val = Math.min(this.limitMax, val);
        (general.data as Record<string, any>)[this.variable] = val;
      }
    } else if (this.operator === '/') {
      if (typeof general.multiplyVarWithLimit === 'function') {
        general.multiplyVarWithLimit(this.variable, 1 / this.value, this.limitMin, this.limitMax);
      } else if (general.data) {
        let val = ((general.data as Record<string, any>)[this.variable] || 0) / this.value;
        if (this.limitMin !== null) val = Math.max(this.limitMin, val);
        if (this.limitMax !== null) val = Math.min(this.limitMax, val);
        (general.data as Record<string, any>)[this.variable] = val;
      }
    }

    this.processConsumableItem();

    return true;
  }
}





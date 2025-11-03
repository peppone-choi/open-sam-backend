import { Condition } from '../Condition';

/**
 * Logic 조건
 * AND, OR, NOT 등의 논리 연산
 */
const AVAILABLE_LOGIC_NAME: Record<string, string> = {
  'and': 'And',
  'or': 'Or',
  'not': 'Not',
  'xor': 'Xor',
  'nand': 'Nand',
  'nor': 'Nor',
};

export { AVAILABLE_LOGIC_NAME };

/**
 * AND 조건
 */
class And extends Condition {
  constructor(private conditions: Condition[]) {
    super();
  }

  eval(env?: any): { value: boolean; chain: string[] } {
    const chain = ['And'];
    for (const condition of this.conditions) {
      const result = condition.eval(env);
      chain.push(...result.chain);
      if (!result.value) {
        return { value: false, chain };
      }
    }
    return { value: true, chain };
  }
}

/**
 * OR 조건
 */
class Or extends Condition {
  constructor(private conditions: Condition[]) {
    super();
  }

  eval(env?: any): { value: boolean; chain: string[] } {
    const chain = ['Or'];
    for (const condition of this.conditions) {
      const result = condition.eval(env);
      chain.push(...result.chain);
      if (result.value) {
        return { value: true, chain };
      }
    }
    return { value: false, chain };
  }
}

/**
 * NOT 조건
 */
class Not extends Condition {
  constructor(private condition: Condition) {
    super();
  }

  eval(env?: any): { value: boolean; chain: string[] } {
    const result = this.condition.eval(env);
    return {
      value: !result.value,
      chain: ['Not', ...result.chain]
    };
  }
}

/**
 * XOR 조건
 */
class Xor extends Condition {
  constructor(private conditions: Condition[]) {
    super();
  }

  eval(env?: any): { value: boolean; chain: string[] } {
    const chain = ['Xor'];
    let trueCount = 0;
    for (const condition of this.conditions) {
      const result = condition.eval(env);
      chain.push(...result.chain);
      if (result.value) {
        trueCount++;
      }
    }
    return { value: trueCount === 1, chain };
  }
}

export class Logic extends Condition {
  constructor(private operator: string, ...conditions: any[]) {
    super();
    this.conditions = conditions.map(c => Condition.build(c)) as Condition[];
  }

  private conditions: Condition[];

  eval(env?: any): { value: boolean; chain: string[] } {
    const op = this.operator.toLowerCase();
    if (op === 'and' || op === 'nand') {
      const and = new And(this.conditions);
      const result = and.eval(env);
      if (op === 'nand') {
        return { value: !result.value, chain: ['Nand', ...result.chain] };
      }
      return result;
    }
    if (op === 'or' || op === 'nor') {
      const or = new Or(this.conditions);
      const result = or.eval(env);
      if (op === 'nor') {
        return { value: !result.value, chain: ['Nor', ...result.chain] };
      }
      return result;
    }
    if (op === 'not') {
      if (this.conditions.length !== 1) {
        throw new Error('NOT 조건은 하나의 조건만 필요합니다.');
      }
      const not = new Not(this.conditions[0]);
      return not.eval(env);
    }
    if (op === 'xor') {
      const xor = new Xor(this.conditions);
      return xor.eval(env);
    }
    throw new Error(`알 수 없는 논리 연산자: ${this.operator}`);
  }
}


import { Condition } from '../Condition';

/**
 * 상대 날짜 조건
 * PHP DateRelative Condition과 동일한 구조
 */
export class DateRelative extends Condition {
  private cmp: string;
  private yearOffset: number | null;
  private monthOffset: number | null;

  constructor(cmp: string, yearOffset: number | null, monthOffset: number | null) {
    super();
    
    const AVAILABLE_CMP: Record<string, boolean> = {
      '==': true,
      '!=': true,
      '<': true,
      '>': true,
      '<=': true,
      '>=': true,
    };

    if (!AVAILABLE_CMP[cmp]) {
      throw new Error('올바르지 않은 비교연산자입니다');
    }

    this.cmp = cmp;
    this.yearOffset = yearOffset;
    this.monthOffset = monthOffset;
  }

  eval(env?: any): { value: boolean; chain: string[] } {
    if (env === null) {
      return {
        value: false,
        chain: ['DateRelative']
      };
    }

    if (this.yearOffset !== null && env['year'] === undefined) {
      throw new Error('env에 year가 없습니다.');
    }

    if (this.yearOffset !== null && env['startyear'] === undefined) {
      throw new Error('env에 startyear가 없습니다.');
    }

    if (this.monthOffset !== null && env['month'] === undefined) {
      throw new Error('env에 month가 없습니다.');
    }

    const lhs = [
      this.yearOffset !== null ? parseInt(env['year']) - parseInt(env['startyear']) : null,
      this.monthOffset !== null ? parseInt(env['month']) : null
    ];

    const rhs = [
      this.yearOffset,
      this.monthOffset
    ];

    let value = false;
    switch (this.cmp) {
      case '==':
        value = JSON.stringify(lhs) === JSON.stringify(rhs);
        break;
      case '!=':
        value = JSON.stringify(lhs) !== JSON.stringify(rhs);
        break;
      case '<=':
        value = this.compareDate(lhs, rhs) <= 0;
        break;
      case '>=':
        value = this.compareDate(lhs, rhs) >= 0;
        break;
      case '<':
        value = this.compareDate(lhs, rhs) < 0;
        break;
      case '>':
        value = this.compareDate(lhs, rhs) > 0;
        break;
    }

    return {
      value,
      chain: ['DateRelative']
    };
  }

  private compareDate(lhs: (number | null)[], rhs: (number | null)[]): number {
    if (lhs[0] !== null && rhs[0] !== null) {
      if (lhs[0] !== rhs[0]) {
        return lhs[0] - rhs[0];
      }
    }
    if (lhs[1] !== null && rhs[1] !== null) {
      if (lhs[1] !== rhs[1]) {
        return lhs[1] - rhs[1];
      }
    }
    return 0;
  }
}


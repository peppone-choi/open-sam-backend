import { Condition } from '../Condition';

/**
 * 날짜 조건
 * PHP Date Condition과 동일한 구조
 */
const AVAILABLE_CMP: Record<string, boolean> = {
  '==': true,
  '!=': true,
  '<': true,
  '>': true,
  '<=': true,
  '>=': true,
};

export class Date extends Condition {
  private cmp: string;
  private year: number | null;
  private month: number | null;

  constructor(cmp: string, year: number | null, month: number | null) {
    super();
    
    if (!AVAILABLE_CMP[cmp]) {
      throw new Error('올바르지 않은 비교연산자입니다');
    }

    if (year === null && month === null) {
      throw new Error('year과 month가 둘다 null일 수 없습니다.');
    }

    this.cmp = cmp;
    this.year = year;
    this.month = month;
  }

  eval(env?: any): { value: boolean; chain: string[] } {
    if (env === null) {
      return {
        value: false,
        chain: ['Date']
      };
    }

    if (this.year !== null && env['year'] === undefined) {
      throw new Error('env에 year가 없습니다.');
    }

    if (this.month !== null && env['month'] === undefined) {
      throw new Error('env에 month가 없습니다.');
    }

    const lhs = [
      this.year !== null ? parseInt(env['year']) : null,
      this.month !== null ? parseInt(env['month']) : null
    ];

    const rhs = [
      this.year,
      this.month
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
      chain: ['Date']
    };
  }

  private compareDate(lhs: (number | null)[], rhs: (number | null)[]): number {
    // Year 비교
    if (lhs[0] !== null && rhs[0] !== null) {
      if (lhs[0] !== rhs[0]) {
        return lhs[0] - rhs[0];
      }
    }
    // Month 비교
    if (lhs[1] !== null && rhs[1] !== null) {
      if (lhs[1] !== rhs[1]) {
        return lhs[1] - rhs[1];
      }
    }
    return 0;
  }
}


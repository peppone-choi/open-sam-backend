import { Condition } from '../Condition';

/**
 * 시간 간격 조건
 * PHP Interval Condition과 동일한 구조 (TODO 상태지만 기본 구조 제공)
 */
export class Interval extends Condition {
  private fromYear: number;
  private fromMonth: number;
  private interval: number;
  private toYear: number | null;
  private toMonth: number | null;

  constructor(fromYear: number, fromMonth: number, interval: number, toYear?: number, toMonth?: number) {
    super();
    this.fromYear = fromYear;
    this.fromMonth = fromMonth;
    this.interval = interval;
    this.toYear = toYear || null;
    this.toMonth = toMonth || null;
  }

  eval(env?: any): { value: boolean; chain: string[] } {
    if (env === null || env['year'] === undefined || env['month'] === undefined) {
      return {
        value: false,
        chain: ['Interval']
      };
    }

    const currentYear = parseInt(env['year']);
    const currentMonth = parseInt(env['month']);
    
    // 시작 날짜 계산
    const monthsFromStart = (currentYear - this.fromYear) * 12 + (currentMonth - this.fromMonth);
    
    // 간격으로 나눠떨어지는지 확인
    const inInterval = monthsFromStart >= 0 && monthsFromStart % this.interval === 0;
    
    // 종료 날짜가 있으면 확인
    if (this.toYear !== null && this.toMonth !== null) {
      const monthsToEnd = (this.toYear - currentYear) * 12 + (this.toMonth - currentMonth);
      if (monthsToEnd < 0) {
        return { value: false, chain: ['Interval'] };
      }
    }

    return {
      value: inInterval,
      chain: ['Interval']
    };
  }
}


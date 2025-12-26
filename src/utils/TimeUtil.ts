import { configManager } from '../config/ConfigManager';

const { timezone } = configManager.get().system;

/**
 * TimeUtil - 시간 관련 유틸리티 함수
 */
export class TimeUtil {
  /**
   * 오늘 날짜 반환 (YYYY-MM-DD)
   */
  static today(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * 현재 시간 반환
   * @param withFraction 마이크로초 포함 여부
   */
  static now(withFraction: boolean = false): string {
    const now = new Date();
    // 타임존 변환 (Intl.DateTimeFormat 사용 권장)
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';
    
    const ymdhms = `${getPart('year')}-${getPart('month')}-${getPart('day')} ${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
    
    if (withFraction) {
      const ms = String(now.getMilliseconds()).padStart(3, '0');
      return `${ymdhms}.${ms}`;
    }
    return ymdhms;
  }

  static nowAddDays(days: number, withFraction: boolean = false): string {
    const now = new Date();
    now.setDate(now.getDate() + days);
    return this.formatDate(now, withFraction);
  }

  static nowAddHours(hours: number, withFraction: boolean = false): string {
    const now = new Date();
    now.setHours(now.getHours() + hours);
    return this.formatDate(now, withFraction);
  }

  static nowAddMinutes(minutes: number, withFraction: boolean = false): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutes);
    return this.formatDate(now, withFraction);
  }

  static nowAddSeconds(seconds: number, withFraction: boolean = false): string {
    const now = new Date();
    now.setSeconds(now.getSeconds() + seconds);
    return this.formatDate(now, withFraction);
  }

  static formatDate(dateTime: Date, withFraction: boolean): string {
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(dateTime);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';
    
    const ymdhms = `${getPart('year')}-${getPart('month')}-${getPart('day')} ${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
    
    if (withFraction) {
      const ms = String(dateTime.getMilliseconds()).padStart(3, '0');
      return `${ymdhms}.${ms}`;
    }
    return ymdhms;
  }

  static safeYearToMonths(year: number): number {
    const MAX_SAFE_YEAR = Math.floor(Number.MAX_SAFE_INTEGER / 12);
    if (year > MAX_SAFE_YEAR || year < -MAX_SAFE_YEAR) {
      throw new Error(`Year ${year} out of range`);
    }
    return year * 12;
  }

  static safeTotalMonths(startYear: number, elapsedTurns: number): number {
    const baseMonths = this.safeYearToMonths(startYear);
    if (elapsedTurns > Number.MAX_SAFE_INTEGER - baseMonths) {
      throw new Error(`Overflow in total months`);
    }
    return baseMonths + elapsedTurns;
  }

  static isValidDate(date: Date | string | null | undefined, maxYearDiff: number = 10): boolean {
    if (!date) return false;
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return false;
    const now = new Date();
    const diffMs = Math.abs(now.getTime() - dateObj.getTime());
    return diffMs <= maxYearDiff * 365 * 24 * 60 * 60 * 1000;
  }

  static safeDate(dateInput: any, fallback: Date = new Date()): Date {
    if (!dateInput) return fallback;
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    return this.isValidDate(date) ? date : fallback;
  }

  static validateStarttime(starttime: string | Date, allowFuture: boolean = false): string {
    const date = this.safeDate(starttime);
    if (!allowFuture && date.getTime() > Date.now()) throw new Error('Future starttime not allowed');
    return date.toISOString();
  }

  static diffInSeconds(date1: Date, date2: Date): number {
    return Math.floor((date2.getTime() - date1.getTime()) / 1000);
  }

  static diffInDays(date1: Date, date2: Date): number {
    return Math.floor((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
  }

  static secondsToDateTime(fullSeconds: number, isUTC: boolean = false): Date {
    const date = new Date(0);
    if (isUTC) date.setUTCMilliseconds(fullSeconds * 1000);
    else date.setMilliseconds(fullSeconds * 1000);
    return date;
  }

  static dateTimeToSeconds(dateTime: Date, _isUTC: boolean = false): number {
    return Math.floor(dateTime.getTime() / 1000);
  }

  static nowDateTime(): Date {
    return new Date();
  }

  static format(dateTime: Date, withFraction: boolean): string {
    return this.formatDate(dateTime, withFraction);
  }

  static isRangeMonth(baseYear: number, baseMonth: number, afterMonth: number, askYear: number, askMonth: number): boolean {
    const minMonth = baseYear * 12 + baseMonth;
    const askMonthValue = askYear * 12 + askMonth;
    const maxMonth = minMonth + Math.abs(afterMonth);
    const finalMin = afterMonth < 0 ? minMonth + afterMonth : minMonth;
    const finalMax = afterMonth < 0 ? minMonth : maxMonth;
    return askMonthValue >= finalMin && askMonthValue <= finalMax;
  }

  static parseDateTime(dateStr: string): Date {
    return new Date(dateStr);
  }
}

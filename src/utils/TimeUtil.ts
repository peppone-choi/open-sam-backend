/**
 * TimeUtil - PHP TimeUtil 클래스 변환
 * 시간 관련 유틸리티 함수
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
    // 한국 시간대(Asia/Seoul, UTC+9)로 변환
    // 시스템이 이미 한국 시간대면 로컬 시간 사용, 아니면 UTC+9 적용
    // process.env.TZ가 설정되어 있으면 Node.js가 자동으로 처리
    const kstOffset = 9 * 60 * 60 * 1000; // 9시간 (밀리초)
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000); // UTC 기준 시간
    const kstTime = new Date(utcTime + kstOffset);
    
    const year = kstTime.getUTCFullYear();
    const month = String(kstTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(kstTime.getUTCDate()).padStart(2, '0');
    const hours = String(kstTime.getUTCHours()).padStart(2, '0');
    const minutes = String(kstTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(kstTime.getUTCSeconds()).padStart(2, '0');
    
    if (withFraction) {
      const milliseconds = String(kstTime.getUTCMilliseconds()).padStart(3, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    }
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * 현재 시간에 일수 추가
   */
  static nowAddDays(days: number, withFraction: boolean = false): string {
    const now = new Date();
    now.setDate(now.getDate() + days);
    return this.formatDate(now, withFraction);
  }

  /**
   * 현재 시간에 시간 추가
   */
  static nowAddHours(hours: number, withFraction: boolean = false): string {
    const now = new Date();
    now.setHours(now.getHours() + hours);
    return this.formatDate(now, withFraction);
  }

  /**
   * 현재 시간에 분 추가
   */
  static nowAddMinutes(minutes: number, withFraction: boolean = false): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutes);
    return this.formatDate(now, withFraction);
  }

  /**
   * 현재 시간에 초 추가
   */
  static nowAddSeconds(seconds: number, withFraction: boolean = false): string {
    const now = new Date();
    now.setSeconds(now.getSeconds() + seconds);
    return this.formatDate(now, withFraction);
  }

  /**
   * Date 객체를 문자열로 포맷팅
   */
  static formatDate(dateTime: Date, withFraction: boolean): string {
    // 한국 시간대(Asia/Seoul, UTC+9)로 변환
    const kstOffset = 9 * 60 * 60 * 1000; // 9시간 (밀리초)
    const utcTime = dateTime.getTime() + (dateTime.getTimezoneOffset() * 60 * 1000); // UTC 기준 시간
    const kstTime = new Date(utcTime + kstOffset);
    
    const year = kstTime.getUTCFullYear();
    const month = String(kstTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(kstTime.getUTCDate()).padStart(2, '0');
    const hours = String(kstTime.getUTCHours()).padStart(2, '0');
    const minutes = String(kstTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(kstTime.getUTCSeconds()).padStart(2, '0');
    
    if (!withFraction) {
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    const milliseconds = String(kstTime.getUTCMilliseconds()).padStart(3, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  }

  /**
   * 안전한 year * 12 계산 (오버플로우 방지)
   * JavaScript Number.MAX_SAFE_INTEGER는 9007199254740991
   * year * 12가 안전한 범위 내에 있는지 확인
   */
  static safeYearToMonths(year: number): number {
    const MAX_SAFE_YEAR = Math.floor(Number.MAX_SAFE_INTEGER / 12); // ~750599937895007
    const MIN_SAFE_YEAR = Math.ceil(Number.MIN_SAFE_INTEGER / 12);
    
    if (year > MAX_SAFE_YEAR || year < MIN_SAFE_YEAR) {
      throw new Error(`Year ${year} is out of safe range for month calculation (${MIN_SAFE_YEAR} to ${MAX_SAFE_YEAR})`);
    }
    
    return year * 12;
  }

  /**
   * 안전한 totalMonths 계산 (오버플로우 방지)
   * startYear * 12 + elapsedTurns 연산이 안전한지 확인
   */
  static safeTotalMonths(startYear: number, elapsedTurns: number): number {
    const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
    
    // startYear * 12가 안전한지 확인
    const baseMonths = this.safeYearToMonths(startYear);
    
    // 덧셈이 오버플로우하지 않는지 확인
    if (elapsedTurns > MAX_SAFE_INTEGER - baseMonths) {
      throw new Error(`Total months calculation would overflow: ${startYear} * 12 + ${elapsedTurns}`);
    }
    
    return baseMonths + elapsedTurns;
  }

  /**
   * 날짜가 합리적인 범위 내에 있는지 확인
   * @param date 확인할 날짜
   * @param maxYearDiff 현재 날짜로부터 최대 허용 연도 차이 (기본 10년)
   * @returns 유효하면 true
   */
  static isValidDate(date: Date | string | null | undefined, maxYearDiff: number = 10): boolean {
    if (!date) return false;
    
    const dateObj = date instanceof Date ? date : new Date(date);
    
    // Invalid Date 체크
    if (isNaN(dateObj.getTime())) return false;
    
    const now = new Date();
    const diffMs = Math.abs(now.getTime() - dateObj.getTime());
    const maxDiffMs = maxYearDiff * 365 * 24 * 60 * 60 * 1000;
    
    // 현재 시간으로부터 maxYearDiff년 이상 차이나면 invalid
    return diffMs <= maxDiffMs;
  }

  /**
   * 안전한 Date 생성 (유효성 검증 포함)
   * @param dateInput 날짜 입력 (Date, string, number 등)
   * @param fallback 유효하지 않을 경우 대체값 (기본값: 현재 시간)
   * @returns 유효한 Date 객체
   */
  static safeDate(dateInput: any, fallback: Date = new Date()): Date {
    if (!dateInput) return fallback;
    
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    
    // Invalid Date이거나 비정상적인 범위면 fallback 반환
    if (!this.isValidDate(date)) {
      console.warn(`[TimeUtil] Invalid date detected: ${dateInput}, using fallback`);
      return fallback;
    }
    
    return date;
  }

  /**
   * starttime을 안전하게 설정 (관리자 입력 검증용)
   * @param starttime 설정할 시작 시간
   * @param allowFuture 미래 날짜 허용 여부 (기본 false)
   * @returns 검증된 ISO string
   */
  static validateStarttime(starttime: string | Date, allowFuture: boolean = false): string {
    const date = this.safeDate(starttime);
    const now = new Date();
    
    // 미래 날짜 체크
    if (!allowFuture && date.getTime() > now.getTime()) {
      throw new Error('Starttime cannot be in the future');
    }
    
    // 너무 과거인지 체크 (현재로부터 10년 이전)
    const tenYearsAgo = new Date(now.getTime() - 10 * 365 * 24 * 60 * 60 * 1000);
    if (date.getTime() < tenYearsAgo.getTime()) {
      throw new Error('Starttime is too far in the past (more than 10 years)');
    }
    
    return date.toISOString();
  }

  /**
   * 두 날짜 간 차이를 초로 계산
   */
  static diffInSeconds(date1: Date, date2: Date): number {
    return Math.floor((date2.getTime() - date1.getTime()) / 1000);
  }

  /**
   * 두 날짜 간 차이를 일수로 계산
   */
  static diffInDays(date1: Date, date2: Date): number {
    const diffTime = date2.getTime() - date1.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * 초를 Date 객체로 변환
   */
  static secondsToDateTime(fullSeconds: number, isUTC: boolean = false): Date {
    const date = new Date(0);
    if (isUTC) {
      date.setUTCMilliseconds(fullSeconds * 1000);
    } else {
      date.setMilliseconds(fullSeconds * 1000);
    }
    return date;
  }

  /**
   * Date 객체를 초로 변환
   */
  static dateTimeToSeconds(dateTime: Date, isUTC: boolean = false): number {
    const baseDate = new Date(0);
    if (isUTC) {
      return Math.floor((dateTime.getTime() - baseDate.getTime()) / 1000);
    }
    return Math.floor((dateTime.getTime() - baseDate.getTime()) / 1000);
  }

  /**
   * 현재 Date 객체 반환
   */
  static nowDateTime(): Date {
    return new Date();
  }

  /**
   * Date 객체를 문자열로 포맷팅 (formatDate의 별칭)
   */
  static format(dateTime: Date, withFraction: boolean): string {
    return this.formatDate(dateTime, withFraction);
  }

  /**
   * 월 범위 확인
   * baseYear, baseMonth부터 afterMonth 개월 이내인지 확인
   */
  static isRangeMonth(
    baseYear: number,
    baseMonth: number,
    afterMonth: number,
    askYear: number,
    askMonth: number
  ): boolean {
    if (baseMonth < 1 || baseMonth > 12) {
      throw new Error('개월이 올바르지 않음');
    }
    if (askMonth < 1 || askMonth > 12) {
      throw new Error('개월이 올바르지 않음');
    }

    let minMonth = baseYear * 12 + baseMonth;
    if (afterMonth < 0) {
      const maxMonth = minMonth;
      minMonth = maxMonth - afterMonth;
    }

    const maxMonth = minMonth + afterMonth;
    const askMonthValue = askYear * 12 + askMonth;
    
    return askMonthValue >= minMonth && askMonthValue <= maxMonth;
  }

  /**
   * 문자열을 Date 객체로 파싱
   */
  static parseDateTime(dateStr: string): Date {
    return new Date(dateStr);
  }
}

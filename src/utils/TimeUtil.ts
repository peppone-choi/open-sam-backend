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
    return this.format(now, withFraction);
  }

  /**
   * 현재 시간에 시간 추가
   */
  static nowAddHours(hours: number, withFraction: boolean = false): string {
    const now = new Date();
    now.setHours(now.getHours() + hours);
    return this.format(now, withFraction);
  }

  /**
   * 현재 시간에 분 추가
   */
  static nowAddMinutes(minutes: number, withFraction: boolean = false): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutes);
    return this.format(now, withFraction);
  }

  /**
   * 현재 시간에 초 추가
   */
  static nowAddSeconds(seconds: number, withFraction: boolean = false): string {
    const now = new Date();
    now.setSeconds(now.getSeconds() + seconds);
    return this.format(now, withFraction);
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
   * Date 객체를 문자열로 포맷팅
   */
  static format(dateTime: Date, withFraction: boolean): string {
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
}




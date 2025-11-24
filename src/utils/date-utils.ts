/**
 * Date Utilities
 * PHP func.php 날짜 관련 함수 구현
 */

/**
 * 년월 조합
 * PHP: joinYearMonth($year, $month)
 */
export function joinYearMonth(year: number, month: number): number {
  return year * 12 + month;
}

/**
 * 년월 분리
 * PHP: extractYearMonth($value)
 */
export function extractYearMonth(value: number): { year: number; month: number } {
  const year = Math.floor(value / 12);
  const month = value % 12;
  
  return { year, month };
}

/**
 * 턴타임을 년월로 변환
 */
export function turntimeToYearMonth(turntime: string | Date): { year: number; month: number } {
  const date = typeof turntime === 'string' ? new Date(turntime) : turntime;
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 0-based to 1-based
  
  return { year, month };
}

/**
 * 년월을 문자열로 변환
 */
export function formatYearMonth(year: number, month: number): string {
  return `${year}년 ${month}월`;
}

/**
 * 현재 턴의 년월 조합값 반환
 */
export function getCurrentYearMonth(turntime: string | Date): number {
  const { year, month } = turntimeToYearMonth(turntime);
  return joinYearMonth(year, month);
}

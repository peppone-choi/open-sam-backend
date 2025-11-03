/**
 * StringUtil - PHP StringUtil 클래스 변환
 * 문자열 정제 및 검증 유틸리티
 */

/**
 * 특수 문자 제거
 * HTML 태그, 스크립트 태그 등을 제거
 */
export function removeSpecialCharacter(str: string): string {
  if (typeof str !== 'string') {
    return str;
  }
  
  // HTML 태그 제거
  let result = str.replace(/<[^>]*>/g, '');
  
  // 스크립트 태그 제거 (대소문자 무시)
  result = result.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  
  // 위험한 문자열 패턴 제거
  result = result.replace(/javascript:/gi, '');
  result = result.replace(/on\w+\s*=/gi, '');
  
  return result;
}

/**
 * 문자열 중성화
 * XSS 방지를 위한 추가 정제
 */
export function neutralize(str: string): string {
  if (typeof str !== 'string') {
    return str;
  }
  
  // 이미 removeSpecialCharacter로 처리된 문자열을 추가 정제
  let result = str.trim();
  
  // HTML 엔티티 제거하지 않음 (표시용)
  // 공백 정리
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

/**
 * 문자열 폭 계산 (한글 = 2, 영문 = 1)
 */
export function getStringWidth(str: string): number {
  let width = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const code = char.charCodeAt(0);
    
    // 한글 범위: 0xAC00-0xD7A3
    if (code >= 0xAC00 && code <= 0xD7A3) {
      width += 2;
    } else if (code > 127) {
      // 기타 멀티바이트 문자
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/**
 * 문자열 폭 검증 (min <= width <= max)
 */
export function checkStringWidth(str: string, min: number, max: number): boolean {
  const width = getStringWidth(str);
  return width >= min && width <= max;
}


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

/**
 * 전각, 반각 길이 기준의 substr
 * @param str 원본 문자열
 * @param start 시작 너비. 음수의 경우 뒤에서부터
 * @param width 길이. null일 경우 끝까지
 */
export function subStringForWidth(str: string, start: number = 0, width: number | null = null): string {
  const length = getStringWidth(str);
  if (width === null) {
    width = length;
  }

  let actualStart = start;
  if (start < 0) {
    actualStart = length + start;
  }

  const strings = splitString(str);
  let currentPos = 0;
  let currentWidth = 0;
  let rawStart = 0;
  let rawWidth = 0;

  // 시작 위치 찾기
  for (let idx = 0; idx < strings.length; idx++) {
    const char = strings[idx];
    const charWidth = getStringWidth(char);
    if (currentPos + charWidth > actualStart) {
      break;
    }
    currentPos += charWidth;
    rawStart += char.length;
  }

  // 끝 위치 확인
  if (currentPos + width >= length) {
    return str.substring(rawStart);
  }

  // 끝 위치 찾기
  for (let idx = 0; idx < strings.length; idx++) {
    const char = strings[rawStart + idx];
    if (!char) break;
    const charWidth = getStringWidth(char);
    if (currentWidth + charWidth > width) {
      break;
    }
    currentWidth += charWidth;
    rawWidth += char.length;
  }

  return str.substring(rawStart, rawStart + rawWidth);
}

/**
 * 문자열을 지정된 너비로 자르고 끝에 endFill 추가
 */
export function cutStringForWidth(str: string, width: number, endFill: string = '..'): string {
  if (getStringWidth(str) <= width) {
    return str;
  }

  let result = '';
  const endFillWidth = getStringWidth(endFill);
  width -= endFillWidth;

  const strings = splitString(str);
  for (const char of strings) {
    const charWidth = getStringWidth(char);
    if (charWidth > width) {
      break;
    }
    result += char;
    width -= charWidth;
  }

  return result + endFill;
}

/**
 * 문자열을 문자 단위로 분할
 * @param str 원본 문자열
 * @param l 길이 (0이면 모든 문자를 개별 분할)
 */
export function splitString(str: string, l: number = 0): string[] {
  if (l > 0) {
    const ret: string[] = [];
    const len = str.length;
    for (let i = 0; i < len; i += l) {
      ret.push(str.substr(i, l));
    }
    return ret;
  }
  
  // UTF-8 문자 단위로 분할
  const result: string[] = [];
  const regex = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u0000-\uFFFF]/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    result.push(match[0]);
  }
  return result;
}

/**
 * str_pad를 유니코드에서 사용할 수 있는 함수, monospace 전각, 반각 구분을 포함
 * @param str 원본 문자열
 * @param maxsize 채우고자 하는 너비
 * @param ch 채움 문자열
 * @param position -1:왼쪽(오른쪽을 채움), 0:가운데(양쪽을 채움), 1:오른쪽(왼쪽을 채움)
 */
export function padString(str: string, maxsize: number, ch: string = ' ', position: number = 0): string {
  const chLen = getStringWidth(ch);

  if (chLen === 0) {
    return padString(str, maxsize, ' ', position);
  }

  const textLen = getStringWidth(str);
  if (maxsize <= textLen) {
    return str;
  }

  const fillTextCnt = Math.floor((maxsize - textLen) / chLen);

  let fillLeftCnt = 0;
  let fillRightCnt = 0;

  if (position < 0) {
    fillLeftCnt = 0;
    fillRightCnt = fillTextCnt;
  } else if (position > 0) {
    fillLeftCnt = fillTextCnt;
    fillRightCnt = 0;
  } else {
    fillLeftCnt = Math.floor(fillTextCnt / 2);
    fillRightCnt = fillTextCnt - fillLeftCnt;
  }

  return ch.repeat(fillLeftCnt) + str + ch.repeat(fillRightCnt);
}

export function padStringAlignRight(str: string, maxsize: number, ch: string = ' '): string {
  return padString(str, maxsize, ch, 1);
}

export function padStringAlignLeft(str: string, maxsize: number, ch: string = ' '): string {
  return padString(str, maxsize, ch, -1);
}

export function padStringAlignCenter(str: string, maxsize: number, ch: string = ' '): string {
  return padString(str, maxsize, ch, 0);
}

/**
 * 유니코드 문자를 코드 포인트로 변환
 */
export function uniord(c: string): number {
  if (c.length === 0) return 0;
  
  const c0 = c.charCodeAt(0);
  if (c0 >= 0 && c0 <= 127) {
    return c0;
  }
  
  // UTF-8 멀티바이트 문자 처리
  if (c.length >= 2) {
    const c1 = c.charCodeAt(1);
    if (c0 >= 0xC0 && c0 <= 0xDF) {
      return (c0 - 0xC0) * 64 + (c1 - 0x80);
    }
    if (c.length >= 3 && c0 >= 0xE0 && c0 <= 0xEF) {
      const c2 = c.charCodeAt(2);
      return (c0 - 0xE0) * 4096 + (c1 - 0x80) * 64 + (c2 - 0x80);
    }
    if (c.length >= 4 && c0 >= 0xF0 && c0 <= 0xF7) {
      const c2 = c.charCodeAt(2);
      const c3 = c.charCodeAt(3);
      return (c0 - 0xF0) * 262144 + (c1 - 0x80) * 4096 + (c2 - 0x80) * 64 + (c3 - 0x80);
    }
  }
  
  // 기본적으로 유니코드 코드 포인트 반환
  return c.codePointAt(0) || 0;
}

/**
 * 코드 포인트를 유니코드 문자로 변환
 */
export function unichr(o: number): string {
  if (o <= 0xFFFF) {
    return String.fromCharCode(o);
  }
  // UTF-16 서로게이트 페어 처리
  o -= 0x10000;
  return String.fromCharCode(
    0xD800 + (o >> 10),
    0xDC00 + (o & 0x3FF)
  );
}

/**
 * HTML 태그 이스케이프
 */
export function escapeTag(str: string | null): string {
  if (!str) {
    return '';
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\r\n|\r|\n/g, '<br>');
}

/**
 * 텍스트 정제 (앞뒤 공백 제거)
 */
export function textStrip(str: string | null): string {
  if (!str) {
    return '';
  }
  return str.replace(/^[\p{Z}\p{C}]+|[\p{Z}\p{C}]+$/gu, '');
}

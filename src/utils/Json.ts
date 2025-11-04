/**
 * Json - PHP Json 클래스 변환
 * JSON 인코딩/디코딩 유틸리티
 */

export class Json {
  static readonly PRETTY = 1 << 0;
  static readonly DELETE_NULL = 1 << 1;
  static readonly NO_CACHE = 1 << 2;
  static readonly PASS_THROUGH = 1 << 3;
  static readonly EMPTY_ARRAY_IS_DICT = 1 << 4;

  /**
   * JSON 인코딩
   */
  static encode(value: any, flag: number = 0): string {
    let rawFlag = 0;

    // PRETTY 플래그 처리
    if (flag & Json.PRETTY) {
      // JavaScript에서는 spaces 옵션으로 처리
    }

    // DELETE_NULL 플래그 처리
    if (flag & Json.DELETE_NULL) {
      value = Json.eraseNullValue(value);
    }

    // EMPTY_ARRAY_IS_DICT 플래그 처리
    if (Array.isArray(value) && value.length === 0 && (flag & Json.EMPTY_ARRAY_IS_DICT)) {
      value = {};
    }

    const spaces = (flag & Json.PRETTY) ? 2 : 0;
    return JSON.stringify(value, null, spaces);
  }

  /**
   * JSON 디코딩 (배열로 반환)
   */
  static decode(value: string | null): any {
    if (value === null || value === undefined) {
      return null;
    }
    return JSON.parse(value);
  }

  /**
   * JSON 디코딩 (객체로 반환)
   */
  static decodeObj(value: string): any {
    if (value === null || value === undefined) {
      return null;
    }
    return JSON.parse(value);
  }

  /**
   * null 값 제거 (재귀적으로)
   */
  private static eraseNullValue(value: any): any {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value.map(item => Json.eraseNullValue(item)).filter(item => item !== undefined);
    }
    if (typeof value === 'object') {
      const result: any = {};
      for (const [key, val] of Object.entries(value)) {
        const cleaned = Json.eraseNullValue(val);
        if (cleaned !== undefined) {
          result[key] = cleaned;
        }
      }
      return result;
    }
    return value;
  }
}

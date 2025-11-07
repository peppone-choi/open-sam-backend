export class Util {
  /**
   * 년월을 정수로 결합 (PHP 호환)
   */
  static joinYearMonth(year: number, month: number): number {
    return year * 12 + month - 1;
  }

  /**
   * 년월 정수를 파싱 (PHP 호환)
   */
  static splitYearMonth(yearMonth: number): [number, number] {
    const year = Math.floor(yearMonth / 12);
    const month = (yearMonth % 12) + 1;
    return [year, month];
  }

  static clamp(value: number, min: number, max?: number): number {
    if (max === undefined) return Math.max(value, min);
    return Math.max(min, Math.min(max, value));
  }

  static round(value: number, decimals: number = 0): number {
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
  }

  static valueFit(value: number, min: number, max?: number): number {
    if (max === undefined) return Math.max(value, min);
    return Math.max(min, Math.min(max, value));
  }

  static toInt(value: any): number {
    return parseInt(value, 10) || 0;
  }

  static convertArrayToDict<T>(array: T[], keyField: keyof T): Record<string, T> {
    const result: Record<string, T> = {};
    for (const item of array) {
      const key = String(item[keyField]);
      result[key] = item;
    }
    return result;
  }

  static range(start: number, end: number, step: number = 1): number[] {
    const result: number[] = [];
    for (let i = start; i < end; i += step) {
      result.push(i);
    }
    return result;
  }

  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static formatNumber(num: number): string {
    return num.toLocaleString();
  }

  static randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  static pick<T>(array: T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array[Math.floor(Math.random() * array.length)];
  }

  static groupBy<T, K extends string | number>(
    array: T[],
    keyFn: (item: T) => K
  ): Record<K, T[]> {
    const result = {} as Record<K, T[]>;
    for (const item of array) {
      const key = keyFn(item);
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(item);
    }
    return result;
  }

  static sum(array: number[]): number {
    return array.reduce((acc, val) => acc + val, 0);
  }

  static average(array: number[]): number {
    if (array.length === 0) return 0;
    return this.sum(array) / array.length;
  }

  static unique<T>(array: T[]): T[] {
    return Array.from(new Set(array));
  }

  static chunk<T>(array: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  }

  static flatten<T>(array: T[][]): T[] {
    return array.reduce((acc, val) => acc.concat(val), []);
  }

  static isEmpty(obj: any): boolean {
    if (obj === null || obj === undefined) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    if (typeof obj === 'string') return obj.length === 0;
    return false;
  }

  static deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }


  static numberFormat(num: number, decimals: number = 0): string {
    return num.toLocaleString('ko-KR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  /**
   * 배열에서 랜덤 선택
   */
  static choiceRandom<T>(array: T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * 가중치를 사용한 랜덤 선택
   * @param items [value, weight][] 형태의 배열
   * @returns [selectedValue, remainingItems]
   */
  static choiceRandomUsingWeightPair<T>(items: [T, number][]): [T, T[]] {
    if (items.length === 0) {
      throw new Error('배열이 비어있습니다');
    }

    const totalWeight = items.reduce((sum, [, weight]) => sum + weight, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < items.length; i++) {
      const [value, weight] = items[i];
      random -= weight;
      if (random <= 0) {
        const remaining = items.filter((_, idx) => idx !== i).map(([v]) => v);
        return [value, remaining];
      }
    }

    // Fallback (should not happen)
    const [value] = items[items.length - 1];
    const remaining = items.slice(0, -1).map(([v]) => v);
    return [value, remaining];
  }

  /**
   * 비밀번호 해시 생성 (PHP Util::hashPassword와 동일)
   */
  static hashPassword(salt: string, password: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha512').update(salt + password + salt).digest('hex');
  }

  /**
   * 랜덤 문자열 생성
   */
  static randomStr(length: number, keyspace: string = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'): string {
    const crypto = require('crypto');
    let str = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, keyspace.length);
      str += keyspace[randomIndex];
    }
    return str;
  }

  /**
   * 딕셔너리 맵핑 (key와 value를 모두 사용)
   */
  static mapWithKey<K extends string | number, V, R>(
    callback: (key: K, value: V) => R,
    dict: Record<K, V>
  ): Record<K, R> {
    const result = {} as Record<K, R>;
    for (const [key, value] of Object.entries(dict)) {
      result[key as K] = callback(key as K, value as V);
    }
    return result;
  }

  /**
   * 배열을 Set-like 객체로 변환
   */
  static convertArrayToSetLike<T extends string | number>(
    arr: T[],
    valueIsKey: boolean = true
  ): Record<T, T | number> {
    const result = {} as Record<T, T | number>;
    for (const datum of arr) {
      result[datum] = valueIsKey ? datum : 1;
    }
    return result;
  }

  /**
   * null 값 제거 (재귀적으로)
   */
  static eraseNullValue(value: any): any {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value.map(item => this.eraseNullValue(item)).filter(item => item !== undefined);
    }
    if (typeof value === 'object') {
      const result: any = {};
      for (const [key, val] of Object.entries(value)) {
        const cleaned = this.eraseNullValue(val);
        if (cleaned !== undefined) {
          result[key] = cleaned;
        }
      }
      return result;
    }
    return value;
  }

  /**
   * 안전한 int 변환 (PHP Util::toInt와 유사)
   */
  static toIntSafe(val: any, silent: boolean = false): number | null {
    if (val === null || val === undefined) {
      return null;
    }
    if (typeof val === 'number') {
      if (Number.isInteger(val)) {
        return val;
      }
      return Math.floor(val);
    }
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'null') {
        return null;
      }
      const num = parseFloat(val);
      if (!isNaN(num)) {
        return Math.floor(num);
      }
      if (silent) {
        if (val === '') {
          return null;
        }
        return 0;
      }
      throw new Error(`올바르지 않은 타입형: ${val}`);
    }
    if (silent) {
      return null;
    }
    throw new Error(`올바르지 않은 타입형: ${val}`);
  }

  /**
   * 페어 배열을 딕셔너리로 변환
   */
  static convertPairArrayToDict<T>(arr: [string | number, T][]): Record<string, T> {
    const result: Record<string, T> = {};
    for (const [key, val] of arr) {
      result[String(key)] = val;
    }
    return result;
  }

  /**
   * 튜플 배열을 딕셔너리로 변환
   */
  static convertTupleArrayToDict<T>(arr: T[][]): Record<string, T[]> {
    const result: Record<string, T[]> = {};
    for (const val of arr) {
      if (val.length > 0) {
        const key = String(val[0]);
        result[key] = val.slice(1);
      }
    }
    return result;
  }

  /**
   * 딕셔너리를 배열로 변환
   */
  static convertDictToArray<T>(dict: Record<string, T>, withKey: boolean = true): [string, T][] | T[] {
    const result: any[] = [];
    for (const [key, value] of Object.entries(dict)) {
      if (withKey) {
        result.push([key, value]);
      } else {
        result.push(value);
      }
    }
    return result;
  }

  /**
   * 배열에서 특정 키 추출
   */
  static squeezeFromArray<T>(dict: Record<string, T>, key: string): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [dictKey, value] of Object.entries(dict)) {
      if (typeof value === 'object' && value !== null && key in value) {
        result[dictKey] = value[key];
      }
    }
    return result;
  }

  /**
   * 딕셔너리인지 확인
   */
  static isDict(array: any): boolean {
    if (array === null || array === undefined) {
      return false;
    }
    if (!Array.isArray(array) && typeof array !== 'object') {
      return false;
    }
    if (Array.isArray(array)) {
      if (array.length === 0) {
        return true;
      }
      let idx = 0;
      for (const key of Object.keys(array)) {
        if (typeof key === 'string') {
          return true;
        }
        const numKey = Number(key);
        if (idx !== numKey) {
          return true;
        }
        idx = numKey + 1;
      }
      return false;
    }
    // 객체인 경우
    return true;
  }

  /**
   * 키-값 쌍을 보존한 섞기
   */
  static shuffleAssoc<T>(array: Record<string, T>): Record<string, T> {
    const keys = Object.keys(array);
    const shuffledKeys = this.shuffle(keys);
    const result: Record<string, T> = {};
    for (const key of shuffledKeys) {
      result[key] = array[key];
    }
    return result;
  }

  /**
   * 퍼센트 문자열을 float으로 변환
   */
  static convPercentStrToFloat(text: string): number | null {
    const match = text.match(/^(\d+(\.\d+)?)%$/);
    if (!match) {
      return null;
    }
    return parseFloat(match[1]) / 100;
  }

  /**
   * 가중치를 사용한 랜덤 선택 (키 반환)
   */
  static choiceRandomUsingWeight<T extends string | number>(
    items: Record<T, number>
  ): T {
    const keys = Object.keys(items) as T[];
    const values = Object.values(items) as number[];
    
    let sum = 0;
    for (const value of values) {
      if (value > 0) {
        sum += value;
      }
    }

    let rd = Math.random() * sum;
    for (let i = 0; i < keys.length; i++) {
      const value = values[i] > 0 ? values[i] : 0;
      if (rd <= value) {
        return keys[i];
      }
      rd -= value;
    }

    // Fallback
    return keys[keys.length - 1];
  }

  /**
   * 최대값을 가진 키 반환
   */
  static getKeyOfMaxValue<T extends string | number>(array: Record<T, number>): T | null {
    let max: number | null = null;
    let result: T | null = null;
    
    for (const [key, value] of Object.entries(array) as [T, number][]) {
      if (max === null || value > max) {
        result = key;
        max = value;
      }
    }
    
    return result;
  }

  /**
   * 클래스 경로에서 클래스 이름 추출
   */
  static getClassName(classpath: string): string {
    const pos = classpath.lastIndexOf('\\');
    if (pos !== -1) {
      return classpath.substring(pos + 1);
    }
    const pos2 = classpath.lastIndexOf('/');
    if (pos2 !== -1) {
      return classpath.substring(pos2 + 1);
    }
    return classpath;
  }

  /**
   * 객체에서 클래스 이름 추출
   */
  static getClassNameFromObj(obj: any): string {
    if (obj && obj.constructor) {
      return obj.constructor.name;
    }
    return 'Unknown';
  }

  /**
   * 배열의 모든 원소가 조건을 만족하는지 확인
   */
  static testArrayValues<T>(
    array: T[],
    callback: ((value: T) => boolean) | null = null
  ): boolean {
    if (callback === null) {
      return array.every(value => Boolean(value));
    }
    return array.every(callback);
  }

  /**
   * 백틱 리스트 포맷팅
   */
  static formatListOfBackticks(array: (string | number)[]): string {
    if (array.length === 0) {
      throw new Error('backtick 목록에 없음');
    }
    
    return array.map(value => {
      const strValue = String(value).replace(/\s/g, '');
      if (strValue.includes('.')) {
        const parts = strValue.split('.');
        return '`' + parts.join('`.`') + '`';
      }
      return `\`${strValue}\``;
    }).join(',');
  }

  /**
   * 배열 비교
   */
  static arrayCompare<T>(
    lhs: T[],
    rhs: T[],
    comp?: (a: T, b: T) => number
  ): number {
    const minLength = Math.min(lhs.length, rhs.length);
    
    for (let i = 0; i < minLength; i++) {
      let compResult: number;
      if (comp) {
        compResult = comp(lhs[i], rhs[i]);
      } else {
        if (lhs[i] < rhs[i]) compResult = -1;
        else if (lhs[i] > rhs[i]) compResult = 1;
        else compResult = 0;
      }
      
      if (compResult !== 0) {
        return compResult;
      }
    }

    // 길이 차이
    if (lhs.length < rhs.length) {
      return -1;
    } else if (lhs.length > rhs.length) {
      return 1;
    }

    return 0;
  }

  /**
   * 2의 거듭제곱인지 확인
   */
  static isPowerOfTwo(number: number): boolean {
    if (number <= 0) {
      return false;
    }
    return (number & (number - 1)) === 0;
  }

  /**
   * Enum 값 추출
   */
  static valueFromEnum(value: string | number | { value: string | number }): string | number {
    if (typeof value === 'object' && value !== null && 'value' in value) {
      return (value as { value: string | number }).value;
    }
    return value as string | number;
  }

  /**
   * Enum 배열에서 값 추출
   */
  static valuesFromEnumArray(
    values: (string | number | { value: string | number })[]
  ): (string | number)[] {
    return values.map(v => this.valueFromEnum(v));
  }

  /**
   * 간단한 직렬화
   */
  static simpleSerialize(...values: (string | number)[]): string {
    const result: string[] = [];
    for (const value of values) {
      if (typeof value === 'string') {
        const length = value.length;
        result.push(`str(${length},${value})`);
      } else if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          result.push(`int(${value})`);
        } else {
          const formatted = value.toFixed(6).replace(/\.?0+$/, '');
          result.push(`float(${formatted})`);
        }
      }
    }
    return result.join('|');
  }

  /**
   * 배열에서 특정 키의 합계
   */
  static arraySumWithKey<T extends Record<string, any>>(
    array: T[],
    key: keyof T
  ): number {
    return array.reduce((sum, item) => {
      const value = item[key];
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);
  }

  /**
   * 배열 그룹화 (키 보존 옵션 포함)
   */
  static arrayGroupByPreserveKey<T extends Record<string, any>>(
    array: T[],
    key: keyof T,
    preserveRowKey: boolean = false
  ): Record<string, T[] | Record<string, T>> {
    const result: any = {};

    if (preserveRowKey) {
      for (let rowKey = 0; rowKey < array.length; rowKey++) {
        const val = array[rowKey];
        const groupKey = key in val ? String(val[key]) : '';
        if (!result[groupKey]) {
          result[groupKey] = {};
        }
        result[groupKey][rowKey] = val;
      }
    } else {
      for (const val of array) {
        const groupKey = key in val ? String(val[key]) : '';
        if (!result[groupKey]) {
          result[groupKey] = [];
        }
        result[groupKey].push(val);
      }
    }

    return result;
  }

  /**
   * 년월 정수를 파싱 (parseYearMonth 별칭)
   */
  static parseYearMonth(yearMonth: number): [number, number] {
    return this.splitYearMonth(yearMonth);
  }

  /**
   * 배열 합계 (키 지정 가능)
   */
  static arraySum<T extends Record<string, any>>(
    array: T[] | number[],
    key?: keyof T
  ): number {
    if (key === undefined) {
      // 숫자 배열인 경우
      return (array as number[]).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
    }
    // 객체 배열인 경우
    return this.arraySumWithKey(array as T[], key);
  }

  /**
   * 배열 그룹화 (간단한 버전)
   */
  static arrayGroupBy<T extends Record<string, any>>(
    array: T[],
    key: keyof T,
    preserveRowKey: boolean = false
  ): Record<string, T[] | Record<string, T>> {
    return this.arrayGroupByPreserveKey(array, key, preserveRowKey);
  }

}




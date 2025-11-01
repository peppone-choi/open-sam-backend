/**
 * PHP 런타임 호환 레이어
 * 
 * PHP의 의미론(연산, 배열, 함수)을 TypeScript에서 정확히 재현
 * 절대 빠뜨리지 않기 위한 완전한 구현
 */

// ============================================================================
// PHP 타입 변환 (Type Casting)
// ============================================================================

export function castInt(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return Math.trunc(v);
  if (typeof v === 'string') {
    const num = parseFloat(v);
    return isNaN(num) ? 0 : Math.trunc(num);
  }
  if (Array.isArray(v)) return v.length > 0 ? 1 : 0;
  if (typeof v === 'object') return Object.keys(v).length > 0 ? 1 : 0;
  return 0;
}

export function castFloat(v: any): number {
  if (v === null || v === undefined) return 0.0;
  if (typeof v === 'boolean') return v ? 1.0 : 0.0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const num = parseFloat(v);
    return isNaN(num) ? 0.0 : num;
  }
  return 0.0;
}

export function castString(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? '1' : '';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return 'Array';
  if (typeof v === 'object') return 'Object';
  return String(v);
}

export function castBool(v: any): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v !== '' && v !== '0';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return false;
}

export function castArray(v: any): any {
  if (Array.isArray(v)) return v;
  if (v === null || v === undefined) return [];
  if (typeof v === 'object') return v;
  return [v];
}

export function castObject(v: any): any {
  if (typeof v === 'object' && v !== null) return v;
  return {};
}

// ============================================================================
// PHP 진리값 (Truthiness)
// ============================================================================

export function bool(v: any): boolean {
  return castBool(v);
}

export function empty(v: any): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return !v;
  if (typeof v === 'number') return v === 0;
  if (typeof v === 'string') return v === '' || v === '0';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

export function isset(...vars: any[]): boolean {
  return vars.every(v => v !== undefined && v !== null);
}

// ============================================================================
// PHP 비교 연산자 (느슨한 비교)
// ============================================================================

export function eq(a: any, b: any): boolean {
  // PHP loose comparison (==)
  if (a === b) return true;
  
  // null/undefined 처리
  if ((a === null || a === undefined) && (b === null || b === undefined)) return true;
  
  // 숫자 비교
  if (typeof a === 'number' || typeof b === 'number') {
    return castFloat(a) === castFloat(b);
  }
  
  // 문자열 비교
  if (typeof a === 'string' || typeof b === 'string') {
    return castString(a) === castString(b);
  }
  
  // 불린 비교
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return castBool(a) === castBool(b);
  }
  
  return a == b;
}

export function neq(a: any, b: any): boolean {
  return !eq(a, b);
}

export function identical(a: any, b: any): boolean {
  return a === b;
}

export function notIdentical(a: any, b: any): boolean {
  return a !== b;
}

export function lt(a: any, b: any): boolean {
  // 숫자 비교 우선
  if (typeof a === 'number' || typeof b === 'number') {
    return castFloat(a) < castFloat(b);
  }
  // 문자열 비교
  if (typeof a === 'string' && typeof b === 'string') {
    return a < b;
  }
  return castFloat(a) < castFloat(b);
}

export function le(a: any, b: any): boolean {
  return lt(a, b) || eq(a, b);
}

export function gt(a: any, b: any): boolean {
  if (typeof a === 'number' || typeof b === 'number') {
    return castFloat(a) > castFloat(b);
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a > b;
  }
  return castFloat(a) > castFloat(b);
}

export function ge(a: any, b: any): boolean {
  return gt(a, b) || eq(a, b);
}

export function spaceship(a: any, b: any): number {
  if (eq(a, b)) return 0;
  return lt(a, b) ? -1 : 1;
}

// ============================================================================
// PHP 논리 연산자
// ============================================================================

export function and(a: any, b: any): boolean {
  return bool(a) && bool(b);
}

export function or(a: any, b: any): boolean {
  return bool(a) || bool(b);
}

export function xor(a: any, b: any): boolean {
  return bool(a) !== bool(b);
}

export function not(a: any): boolean {
  return !bool(a);
}

// ============================================================================
// PHP 산술 연산자
// ============================================================================

export function add(a: any, b: any): number {
  return castFloat(a) + castFloat(b);
}

export function sub(a: any, b: any): number {
  return castFloat(a) - castFloat(b);
}

export function mul(a: any, b: any): number {
  return castFloat(a) * castFloat(b);
}

export function div(a: any, b: any): number {
  return castFloat(a) / castFloat(b);
}

export function intdiv(a: any, b: any): number {
  return Math.trunc(castFloat(a) / castFloat(b));
}

export function mod(a: any, b: any): number {
  const x = castFloat(a);
  const y = castFloat(b);
  const r = x % y;
  // PHP modulo: 음수 처리
  return r < 0 ? r + Math.abs(y) : r;
}

export function pow(a: any, b: any): number {
  return Math.pow(castFloat(a), castFloat(b));
}

export function neg(a: any): number {
  return -castFloat(a);
}

export function pos(a: any): number {
  return +castFloat(a);
}

// ============================================================================
// PHP 문자열 연산자
// ============================================================================

export function concat(...args: any[]): string {
  return args.map(a => castString(a)).join('');
}

// ============================================================================
// PHP 비트 연산자
// ============================================================================

export function bitAnd(a: any, b: any): number {
  return castInt(a) & castInt(b);
}

export function bitOr(a: any, b: any): number {
  return castInt(a) | castInt(b);
}

export function bitXor(a: any, b: any): number {
  return castInt(a) ^ castInt(b);
}

export function bitNot(a: any): number {
  return ~castInt(a);
}

export function shiftLeft(a: any, b: any): number {
  return castInt(a) << castInt(b);
}

export function shiftRight(a: any, b: any): number {
  return castInt(a) >> castInt(b);
}

// ============================================================================
// PHP 배열 (PhpArray)
// ============================================================================

export class PhpArray {
  private data: Map<string | number, any> = new Map();
  private nextIndex: number = 0;
  
  static fromAssoc(obj: Record<string, any>): PhpArray {
    const arr = new PhpArray();
    for (const [key, value] of Object.entries(obj)) {
      arr.set(key, value);
    }
    return arr;
  }
  
  static fromList(items: any[]): PhpArray {
    const arr = new PhpArray();
    items.forEach((value, index) => {
      arr.set(index, value);
    });
    return arr;
  }
  
  get(key: string | number): any {
    return this.data.get(key);
  }
  
  set(key: string | number, value: any): void {
    this.data.set(key, value);
    
    // 숫자 키인 경우 nextIndex 업데이트
    if (typeof key === 'number' && key >= this.nextIndex) {
      this.nextIndex = key + 1;
    }
  }
  
  push(value: any): void {
    this.set(this.nextIndex, value);
  }
  
  has(key: string | number): boolean {
    return this.data.has(key);
  }
  
  delete(key: string | number): void {
    this.data.delete(key);
  }
  
  get length(): number {
    return this.data.size;
  }
  
  keys(): IterableIterator<string | number> {
    return this.data.keys();
  }
  
  values(): IterableIterator<any> {
    return this.data.values();
  }
  
  entries(): IterableIterator<[string | number, any]> {
    return this.data.entries();
  }
  
  toObject(): any {
    const obj: any = {};
    for (const [key, value] of this.data) {
      obj[key] = value;
    }
    return obj;
  }
  
  toArray(): any[] {
    return Array.from(this.data.values());
  }
}

// ============================================================================
// PHP 배열/오프셋 액세스
// ============================================================================

export function offset(arr: any, key: any): any {
  if (arr instanceof PhpArray) {
    return arr.get(key);
  }
  if (Array.isArray(arr)) {
    return arr[castInt(key)];
  }
  if (typeof arr === 'object' && arr !== null) {
    return arr[key];
  }
  return undefined;
}

export function setOffset(arr: any, key: any, value: any): void {
  if (arr instanceof PhpArray) {
    arr.set(key, value);
  } else if (Array.isArray(arr)) {
    arr[castInt(key)] = value;
  } else if (typeof arr === 'object' && arr !== null) {
    arr[key] = value;
  }
}

export function nullsafe(obj: any, key: string): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  return obj[key];
}

// ============================================================================
// PHP 제어 구조 헬퍼
// ============================================================================

export function foreach(arr: any, callback: (key: any, value: any) => void | 'break' | 'continue'): void {
  if (arr instanceof PhpArray) {
    for (const [key, value] of arr.entries()) {
      const result = callback(key, value);
      if (result === 'break') break;
      if (result === 'continue') continue;
    }
  } else if (Array.isArray(arr)) {
    for (let i = 0; i < arr.length; i++) {
      const result = callback(i, arr[i]);
      if (result === 'break') break;
      if (result === 'continue') continue;
    }
  } else if (typeof arr === 'object' && arr !== null) {
    for (const [key, value] of Object.entries(arr)) {
      const result = callback(key, value);
      if (result === 'break') break;
      if (result === 'continue') continue;
    }
  }
}

export function switchLoose(
  cond: any,
  cases: Array<{ caseVals: any[]; body: () => any; hasBreak: boolean }>,
  defaultBody?: () => any
): any {
  let matched = false;
  let fallthrough = false;
  
  for (const c of cases) {
    // Fallthrough 또는 매치
    if (fallthrough || c.caseVals.some(v => eq(cond, v))) {
      matched = true;
      fallthrough = true;
      
      const result = c.body();
      
      // break가 있으면 종료
      if (c.hasBreak) {
        return result;
      }
    }
  }
  
  // default 처리
  if (!matched && defaultBody) {
    return defaultBody();
  }
}

export function match(cond: any, arms: Array<{ conds: any[]; body: () => any }>): any {
  for (const arm of arms) {
    // default는 conds가 비어있음
    if (arm.conds.length === 0) {
      return arm.body();
    }
    
    // 느슨한 비교로 매치
    if (arm.conds.some(c => eq(cond, c))) {
      return arm.body();
    }
  }
  
  throw new Error('Unhandled match value');
}

// ============================================================================
// PHP list() 할당
// ============================================================================

export function listAssign(targets: Array<(v: any) => void>, source: any): void {
  const values = Array.isArray(source) ? source : Object.values(source);
  
  targets.forEach((setter, index) => {
    if (setter) {
      setter(values[index]);
    }
  });
}

// ============================================================================
// PHP 내장 함수
// ============================================================================

const builtinFunctions: Record<string, (...args: any[]) => any> = {
  // 수학
  abs: (n: any) => Math.abs(castFloat(n)),
  floor: (n: any) => Math.floor(castFloat(n)),
  ceil: (n: any) => Math.ceil(castFloat(n)),
  round: (n: any, precision: any = 0) => {
    const p = castInt(precision);
    const mult = Math.pow(10, p);
    return Math.round(castFloat(n) * mult) / mult;
  },
  min: (...args: any[]) => Math.min(...args.map(castFloat)),
  max: (...args: any[]) => Math.max(...args.map(castFloat)),
  pow: (base: any, exp: any) => Math.pow(castFloat(base), castFloat(exp)),
  sqrt: (n: any) => Math.sqrt(castFloat(n)),
  
  // 문자열
  strlen: (s: any) => castString(s).length,
  substr: (s: any, start: any, length?: any) => {
    const str = castString(s);
    const st = castInt(start);
    return length !== undefined ? str.substr(st, castInt(length)) : str.substr(st);
  },
  strpos: (haystack: any, needle: any, offset?: any) => {
    const pos = castString(haystack).indexOf(castString(needle), offset ? castInt(offset) : 0);
    return pos === -1 ? false : pos;
  },
  strtolower: (s: any) => castString(s).toLowerCase(),
  strtoupper: (s: any) => castString(s).toUpperCase(),
  trim: (s: any) => castString(s).trim(),
  explode: (delimiter: any, string: any) => castString(string).split(castString(delimiter)),
  implode: (glue: any, pieces: any) => {
    const arr = Array.isArray(pieces) ? pieces : Object.values(pieces);
    return arr.map(castString).join(castString(glue));
  },
  str_replace: (search: any, replace: any, subject: any) => {
    return castString(subject).replace(new RegExp(castString(search), 'g'), castString(replace));
  },
  number_format: (n: any, decimals?: any) => {
    const num = castFloat(n);
    const dec = decimals !== undefined ? castInt(decimals) : 0;
    return num.toFixed(dec);
  },
  
  // 배열
  count: (arr: any) => {
    if (arr instanceof PhpArray) return arr.length;
    if (Array.isArray(arr)) return arr.length;
    if (typeof arr === 'object' && arr !== null) return Object.keys(arr).length;
    return 0;
  },
  array_key_exists: (key: any, arr: any) => {
    if (arr instanceof PhpArray) return arr.has(key);
    if (Array.isArray(arr)) return castInt(key) < arr.length;
    if (typeof arr === 'object' && arr !== null) return key in arr;
    return false;
  },
  in_array: (needle: any, haystack: any) => {
    if (Array.isArray(haystack)) {
      return haystack.some(v => eq(v, needle));
    }
    if (typeof haystack === 'object' && haystack !== null) {
      return Object.values(haystack).some(v => eq(v, needle));
    }
    return false;
  },
  array_merge: (...arrays: any[]) => {
    const result: any[] = [];
    for (const arr of arrays) {
      if (Array.isArray(arr)) {
        result.push(...arr);
      } else if (typeof arr === 'object' && arr !== null) {
        result.push(...Object.values(arr));
      }
    }
    return result;
  },
  array_keys: (arr: any) => {
    if (arr instanceof PhpArray) return Array.from(arr.keys());
    if (Array.isArray(arr)) return arr.map((_, i) => i);
    if (typeof arr === 'object' && arr !== null) return Object.keys(arr);
    return [];
  },
  array_values: (arr: any) => {
    if (arr instanceof PhpArray) return Array.from(arr.values());
    if (Array.isArray(arr)) return arr;
    if (typeof arr === 'object' && arr !== null) return Object.values(arr);
    return [];
  },
  
  // 타입 체크
  is_numeric: (v: any) => !isNaN(castFloat(v)),
  is_array: (v: any) => Array.isArray(v) || v instanceof PhpArray,
  is_string: (v: any) => typeof v === 'string',
  is_int: (v: any) => typeof v === 'number' && Number.isInteger(v),
  is_float: (v: any) => typeof v === 'number' && !Number.isInteger(v),
  is_bool: (v: any) => typeof v === 'boolean',
  is_null: (v: any) => v === null || v === undefined,
  is_object: (v: any) => typeof v === 'object' && v !== null && !Array.isArray(v),
  
  // JSON
  json_encode: (v: any) => JSON.stringify(v),
  json_decode: (s: any) => JSON.parse(castString(s)),
  
  // 기타
  intdiv: (a: any, b: any) => intdiv(a, b),
  var_dump: (...args: any[]) => console.log(...args),
  print_r: (v: any) => console.log(v),
};

export function func(name: string, ...args: any[]): any {
  const fn = builtinFunctions[name];
  if (!fn) {
    throw new Error(`Unknown PHP function: ${name}`);
  }
  return fn(...args);
}

export function callMethod(obj: any, name: string, args: any[]): any {
  if (!obj || typeof obj[name] !== 'function') {
    throw new Error(`Unknown method: ${name}`);
  }
  return obj[name](...args);
}

export function callStatic(cls: any, name: string, args: any[]): any {
  if (!cls || typeof cls[name] !== 'function') {
    throw new Error(`Unknown static method: ${name}`);
  }
  return cls[name](...args);
}

// ============================================================================
// 에러 억제 (@)
// ============================================================================

export function silent<T>(expr: () => T): T | null {
  try {
    return expr();
  } catch {
    return null;
  }
}

// ============================================================================
// 상수 관리
// ============================================================================

const constants: Record<string, Record<string, any>> = {};

export function defineConst(className: string, constName: string, value: any): void {
  if (!constants[className]) {
    constants[className] = {};
  }
  constants[className][constName] = value;
}

export function getConst(className: string, constName: string): any {
  return constants[className]?.[constName];
}

export function hasConst(className: string, constName: string): boolean {
  return constants[className]?.[constName] !== undefined;
}

// ============================================================================
// 유틸리티
// ============================================================================

export const php = {
  // 타입 캐스팅
  castInt,
  castFloat,
  castString,
  castBool,
  castArray,
  castObject,
  
  // 진리값
  bool,
  empty,
  isset,
  
  // 비교
  eq,
  neq,
  identical,
  notIdentical,
  lt,
  le,
  gt,
  ge,
  spaceship,
  
  // 논리
  and,
  or,
  xor,
  not,
  
  // 산술
  add,
  sub,
  mul,
  div,
  intdiv,
  mod,
  pow,
  neg,
  pos,
  
  // 문자열
  concat,
  
  // 비트
  bitAnd,
  bitOr,
  bitXor,
  bitNot,
  shiftLeft,
  shiftRight,
  
  // 배열
  PhpArray,
  offset,
  setOffset,
  nullsafe,
  foreach,
  
  // 제어
  switchLoose,
  match,
  listAssign,
  
  // 함수
  func,
  callMethod,
  callStatic,
  
  // 에러 억제
  silent,
  
  // 상수
  defineConst,
  getConst,
  hasConst,
};

export default php;

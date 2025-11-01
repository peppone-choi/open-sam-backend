/**
 * 표현식 노드 핸들러
 * 
 * 모든 표현식 노드를 처리 (절대 빠뜨리지 않음)
 */

import * as php from '../phpRuntime';

export type ConvertExpr = (node: any, ctx: Context) => string;
export type ConvertStmt = (node: any, ctx: Context, indent: string) => string;

export interface Context {
  vars: Record<string, boolean>;
  constants?: Record<string, any>;
  [key: string]: any;
}

export interface ExprHandler {
  (node: any, ctx: Context, convertExpr: ConvertExpr, convertStmt: ConvertStmt): string;
}

// ============================================================================
// 리터럴
// ============================================================================

export function number(node: any, ctx: Context): string {
  return node.value?.toString() || '0';
}

export function string(node: any, ctx: Context): string {
  const value = (node.value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  return `"${value}"`;
}

export function boolean(node: any, ctx: Context): string {
  return node.value ? 'true' : 'false';
}

export function nullkeyword(node: any, ctx: Context): string {
  return 'null';
}

export function magic(node: any, ctx: Context): string {
  const value = node.value || node.raw || '';
  switch (value) {
    case '__CLASS__': return '"CurrentClass"';
    case '__METHOD__': return '"currentMethod"';
    case '__FUNCTION__': return '"currentFunction"';
    case '__LINE__': return '0';
    case '__FILE__': return '"currentFile"';
    case '__DIR__': return '"currentDir"';
    case '__NAMESPACE__': return '""';
    case '__TRAIT__': return '""';
    default: return `"${value}"`;
  }
}

// ============================================================================
// 변수와 참조
// ============================================================================

export function variable(node: any, ctx: Context, cx: ConvertExpr): string {
  const name = node.name;
  
  // 특수 변수 매핑
  if (name === 'this') return 'ctx';
  if (name === 'general') return 'general';
  if (name === 'city') return 'city';
  if (name === 'nation') return 'nation';
  if (name === 'arg') return 'arg';
  if (name === 'db') return 'db';
  if (name === 'env') return 'env';
  
  // 변수 등록
  ctx.vars[name] = true;
  
  return name;
}

export function identifier(node: any, ctx: Context): string {
  return node.name || 'id';
}

export function name(node: any, ctx: Context): string {
  return node.name || 'Unknown';
}

export function selfreference(node: any, ctx: Context): string {
  return 'ctx';
}

export function staticreference(node: any, ctx: Context): string {
  return 'ctx';
}

export function parentreference(node: any, ctx: Context): string {
  return 'ctx';
}

// ============================================================================
// Lookup
// ============================================================================

export function propertylookup(node: any, ctx: Context, cx: ConvertExpr): string {
  const what = cx(node.what, ctx);
  const offset = node.offset;
  const prop = offset?.name || 'prop';
  
  // $general->property → general.data.property (특수 처리)
  if (what === 'general' && !['getVar', 'setVar', 'increaseVar', 'save', 'applyDB'].includes(prop)) {
    return `general.data.${prop}`;
  }
  
  // $this->city → city
  if (what === 'ctx' && prop === 'city') return 'city';
  if (what === 'ctx' && prop === 'nation') return 'nation';
  if (what === 'ctx' && prop === 'arg') return 'arg';
  
  return `${what}.${prop}`;
}

export function nullsafepropertylookup(node: any, ctx: Context, cx: ConvertExpr): string {
  const what = cx(node.what, ctx);
  const offset = node.offset;
  const prop = offset?.name || 'prop';
  
  return `php.nullsafe(${what}, "${prop}")`;
}

export function offsetlookup(node: any, ctx: Context, cx: ConvertExpr): string {
  const what = cx(node.what, ctx);
  const offset = cx(node.offset, ctx);
  
  // city/nation 특수 처리
  if (what.includes('city')) {
    return `city.data[${offset}]`;
  }
  if (what.includes('nation')) {
    return `nation.data[${offset}]`;
  }
  
  return `php.offset(${what}, ${offset})`;
}

export function staticlookup(node: any, ctx: Context, cx: ConvertExpr): string {
  const what = node.what;
  const cls = what?.name || 'Unknown';
  const offset = node.offset;
  const prop = offset?.name || 'prop';
  
  // GameConst::$CONST → 상수로 변환
  if (cls === 'GameConst' && ctx.constants?.[prop] !== undefined) {
    return JSON.stringify(ctx.constants[prop]);
  }
  
  // self/static/parent/Unknown → ctx의 상수
  if (cls === 'self' || cls === 'static' || cls === 'parent' || cls === 'Unknown') {
    // 커맨드별 상수는 ctx.constants에서 조회
    return `ctx.constants?.${prop}`;
  }
  
  // this::class → 커맨드 클래스명
  if (cls === 'this' && prop === 'class') {
    return `ctx.commandName`;
  }
  
  // 알려진 상수들
  const knownConstants: Record<string, Record<string, any>> = {
    'general': {
      'TURNTIME_HM': 'HM',
      'TURNTIME_YMD': 'YMD',
    },
    'ActionLogger': {
      'PLAIN': 0,
      'NORMAL': 1,
      'SPECIAL': 2,
    },
  };
  
  if (knownConstants[cls]?.[prop] !== undefined) {
    return JSON.stringify(knownConstants[cls][prop]);
  }
  
  // 상수 조회 시도
  return `(php.getConst("${cls}", "${prop}") ?? null /* ${cls}::${prop} */)`;
}

// ============================================================================
// 연산자 - 이항
// ============================================================================

const binaryOpMap: Record<string, (l: string, r: string) => string> = {
  // 산술
  '+': (l, r) => `php.add(${l}, ${r})`,
  '-': (l, r) => `php.sub(${l}, ${r})`,
  '*': (l, r) => `php.mul(${l}, ${r})`,
  '/': (l, r) => `php.div(${l}, ${r})`,
  '%': (l, r) => `php.mod(${l}, ${r})`,
  '**': (l, r) => `php.pow(${l}, ${r})`,
  
  // 문자열
  '.': (l, r) => `php.concat(${l}, ${r})`,
  
  // 비교
  '==': (l, r) => `php.eq(${l}, ${r})`,
  '!=': (l, r) => `php.neq(${l}, ${r})`,
  '<>': (l, r) => `php.neq(${l}, ${r})`,
  '===': (l, r) => `php.identical(${l}, ${r})`,
  '!==': (l, r) => `php.notIdentical(${l}, ${r})`,
  '<': (l, r) => `php.lt(${l}, ${r})`,
  '<=': (l, r) => `php.le(${l}, ${r})`,
  '>': (l, r) => `php.gt(${l}, ${r})`,
  '>=': (l, r) => `php.ge(${l}, ${r})`,
  '<=>': (l, r) => `php.spaceship(${l}, ${r})`,
  
  // 논리
  'and': (l, r) => `php.and(${l}, ${r})`,
  'or': (l, r) => `php.or(${l}, ${r})`,
  'xor': (l, r) => `php.xor(${l}, ${r})`,
  '&&': (l, r) => `php.and(${l}, ${r})`,
  '||': (l, r) => `php.or(${l}, ${r})`,
  
  // 비트
  '&': (l, r) => `php.bitAnd(${l}, ${r})`,
  '|': (l, r) => `php.bitOr(${l}, ${r})`,
  '^': (l, r) => `php.bitXor(${l}, ${r})`,
  '<<': (l, r) => `php.shiftLeft(${l}, ${r})`,
  '>>': (l, r) => `php.shiftRight(${l}, ${r})`,
  
  // Null coalescing
  '??': (l, r) => `((${l}) ?? (${r}))`,
};

export function bin(node: any, ctx: Context, cx: ConvertExpr): string {
  const left = cx(node.left, ctx);
  const right = cx(node.right, ctx);
  const op = node.type;
  
  const mapper = binaryOpMap[op];
  if (!mapper) {
    throw new Error(`[UNHANDLED] Binary operator: ${op}`);
  }
  
  return mapper(left, right);
}

// ============================================================================
// 연산자 - 단항
// ============================================================================

export function unary(node: any, ctx: Context, cx: ConvertExpr): string {
  const what = cx(node.what, ctx);
  const type = node.type;
  
  switch (type) {
    case '!': return `php.not(${what})`;
    case '~': return `php.bitNot(${what})`;
    case '+': return `php.pos(${what})`;
    case '-': return `php.neg(${what})`;
    case '@': return what; // 에러 억제는 무시
    default:
      throw new Error(`[UNHANDLED] Unary operator: ${type}`);
  }
}

export function post(node: any, ctx: Context, cx: ConvertExpr): string {
  const what = cx(node.what, ctx);
  const type = node.type;
  
  if (type === '+') return `${what}++`;
  if (type === '-') return `${what}--`;
  
  throw new Error(`[UNHANDLED] Post operator: ${type}`);
}

export function pre(node: any, ctx: Context, cx: ConvertExpr): string {
  const what = cx(node.what, ctx);
  const type = node.type;
  
  if (type === '+') return `++${what}`;
  if (type === '-') return `--${what}`;
  
  throw new Error(`[UNHANDLED] Pre operator: ${type}`);
}

// ============================================================================
// 할당
// ============================================================================

export function assign(node: any, ctx: Context, cx: ConvertExpr): string {
  const op = node.operator || '=';
  
  // list() 할당 처리: list($a, $b) = expr
  if (node.left?.kind === 'list') {
    const items = node.left.items || [];
    const right = cx(node.right, ctx);
    const vars: string[] = [];
    
    items.forEach((item: any, index: number) => {
      if (item?.kind === 'entry' && item.value?.kind === 'variable') {
        const varName = item.value.name;
        vars.push(varName);
        ctx.vars[varName] = true;
      } else if (item?.kind === 'variable') {
        const varName = item.name;
        vars.push(varName);
        ctx.vars[varName] = true;
      }
    });
    
    if (vars.length === 0) return 'null';
    
    // [reqGold, reqRice] = await getCost()
    return `([${vars.join(', ')}] = ${right})`;
  }
  
  const left = cx(node.left, ctx);
  const right = cx(node.right, ctx);
  
  // 복합 할당
  if (op === '+=') return `(${left} = php.add(${left}, ${right}))`;
  if (op === '-=') return `(${left} = php.sub(${left}, ${right}))`;
  if (op === '*=') return `(${left} = php.mul(${left}, ${right}))`;
  if (op === '/=') return `(${left} = php.div(${left}, ${right}))`;
  if (op === '%=') return `(${left} = php.mod(${left}, ${right}))`;
  if (op === '.=') return `(${left} = php.concat(${left}, ${right}))`;
  if (op === '&=') return `(${left} = php.bitAnd(${left}, ${right}))`;
  if (op === '|=') return `(${left} = php.bitOr(${left}, ${right}))`;
  if (op === '^=') return `(${left} = php.bitXor(${left}, ${right}))`;
  if (op === '<<=') return `(${left} = php.shiftLeft(${left}, ${right}))`;
  if (op === '>>=') return `(${left} = php.shiftRight(${left}, ${right}))`;
  if (op === '??=') return `(${left} = (${left}) ?? (${right}))`;
  
  // 단순 할당
  return `(${left} = ${right})`;
}

export function assignref(node: any, ctx: Context, cx: ConvertExpr): string {
  const left = cx(node.left, ctx);
  const right = cx(node.right, ctx);
  
  // 참조 할당은 일반 할당으로 처리
  return `(${left} = ${right})`;
}

// ============================================================================
// 삼항/조건 연산자
// ============================================================================

export function retif(node: any, ctx: Context, cx: ConvertExpr): string {
  const test = cx(node.test, ctx);
  const trueExpr = node.trueExpr ? cx(node.trueExpr, ctx) : test;
  const falseExpr = cx(node.falseExpr, ctx);
  
  return `(php.bool(${test}) ? ${trueExpr} : ${falseExpr})`;
}

export function coalesce(node: any, ctx: Context, cx: ConvertExpr): string {
  const left = cx(node.left, ctx);
  const right = cx(node.right, ctx);
  
  return `((${left}) ?? (${right}))`;
}

// ============================================================================
// 배열
// ============================================================================

export function array(node: any, ctx: Context, cx: ConvertExpr): string {
  const items = node.items || [];
  
  if (items.length === 0) return '{}';
  
  // 연관배열 vs 인덱스 배열 판별
  const isAssoc = items.some((i: any) => i.key);
  
  if (isAssoc) {
    const pairs = items.map((i: any) => {
      const key = i.key ? cx(i.key, ctx) : 'null';
      const value = cx(i.value, ctx);
      
      // 동적 키인지 확인 (변수, 함수 호출 등)
      const isDynamicKey = key.includes('ctx.constants') || 
                          key.includes('php.') || 
                          key.includes('(') ||
                          (!key.startsWith('"') && !key.startsWith("'") && isNaN(Number(key)));
      
      if (isDynamicKey) {
        return `[${key}]: ${value}`;
      }
      return `${key}: ${value}`;
    }).filter((p: string) => p);
    
    return `{ ${pairs.join(', ')} }`;
  } else {
    const values = items.map((i: any) => cx(i.value, ctx)).filter((v: string) => v);
    return `[${values.join(', ')}]`;
  }
}

export function entry(node: any, ctx: Context, cx: ConvertExpr): string {
  // array 내부에서 처리되므로 직접 호출되지 않음
  const value = cx(node.value, ctx);
  return value;
}

// ============================================================================
// 호출
// ============================================================================

export function call(node: any, ctx: Context, cx: ConvertExpr, cs: ConvertStmt): string {
  const what = node.what;
  const args = (node.arguments || []).map((a: any) => cx(a, ctx));
  
  // Property lookup: $obj->method()
  if (what?.kind === 'propertylookup') {
    return handleMethodCall(what, args, ctx, cx);
  }
  
  // Static lookup: Class::method()
  if (what?.kind === 'staticlookup') {
    return handleStaticCall(what, args, ctx, cx);
  }
  
  // Name: function()
  if (what?.kind === 'name') {
    return handleFunctionCall(what, args, ctx);
  }
  
  // 기타
  return `null /* call */`;
}

function handleMethodCall(what: any, args: string[], ctx: Context, cx: ConvertExpr): string {
  const obj = cx(what.what, ctx);
  const method = what.offset?.name || 'unknown';
  
  // $general 특수 메서드들
  if (obj === 'general') {
    if (method === 'increaseVar') {
      return `(general.data[${args[0]}] = (general.data[${args[0]}] || 0) + (${args[1] || '0'}))`;
    }
    if (method === 'setVar') {
      return `(general.data[${args[0]}] = ${args[1] || '0'})`;
    }
    if (method === 'getVar') {
      return `(general.data[${args[0]}] || 0)`;
    }
    if (method === 'addExperience') {
      return `(general.data.experience = (general.data.experience || 0) + (${args[0] || '0'}))`;
    }
    if (method === 'addDedication') {
      return `(general.data.dedication = (general.data.dedication || 0) + (${args[0] || '0'}))`;
    }
    if (method === 'increaseVarWithLimit') {
      return `(general.data[${args[0]}] = Math.max((general.data[${args[0]}] || 0) + (${args[1] || '0'}), ${args[2] || '0'}))`;
    }
    if (method === 'save') return `await general.save()`;
    if (method === 'applyDB') return `await general.save()`;
    
    return `await general.${method}(${args.join(', ')})`;
  }
  
  // $db->update()
  if (obj === 'db' && method === 'update') {
    return `await db.update(${args.join(', ')})`;
  }
  
  // $city 메서드들
  if (obj === 'city') {
    if (method === 'save') return `await city.save()`;
    return `await city.${method}(${args.join(', ')})`;
  }
  
  // $nation 메서드들
  if (obj === 'nation') {
    if (method === 'save') return `await nation.save()`;
    return `await nation.${method}(${args.join(', ')})`;
  }
  
  // 일반 메서드 호출
  return `php.callMethod(${obj}, "${method}", [${args.join(', ')}])`;
}

function handleStaticCall(what: any, args: string[], ctx: Context, cx: ConvertExpr): string {
  const cls = what.what?.name || 'Class';
  const method = what.offset?.name || 'method';
  
  // Util 클래스
  if (cls === 'Util') {
    if (method === 'round') return `Math.round(${args[0] || '0'})`;
    if (method === 'valueFit') {
      const val = args[0] || '0';
      const min = args[1] || '0';
      const max = args[2];
      return max ? `Math.max(${min}, Math.min(${val}, ${max}))` : `Math.max(${min}, ${val})`;
    }
    if (method === 'randomInt') return `Math.floor(Math.random() * (${args[0] || '100'}))`;
  }
  
  // DB
  if (cls === 'DB' && method === 'db') return 'db';
  
  // StaticEventHandler
  if (cls === 'StaticEventHandler' && method === 'handleEvent') {
    return `await ctx.handleEvent(${args.join(', ')})`;
  }
  
  // CityConst
  if (cls === 'CityConst') {
    if (method === 'byID') return `await db.city.findById(${args[0]})`;
    if (method === 'byName') return `await db.city.findByName(${args[0]})`;
  }
  
  // GeneralConst
  if (cls === 'GeneralConst') {
    if (method === 'byID') return `await db.general.findById(${args[0]})`;
  }
  
  // NationConst
  if (cls === 'NationConst') {
    if (method === 'byID') return `await db.nation.findById(${args[0]})`;
  }
  
  // 메시지 클래스들
  if (cls.includes('Message')) {
    return `await ctx.sendMessage("${method}", ${args.join(', ')})`;
  }
  
  // 기타 정적 메서드
  return `await php.callStatic("${cls}", "${method}", [${args.join(', ')}])`;
}

function handleFunctionCall(what: any, args: string[], ctx: Context): string {
  const name = what.name || 'func';
  
  // PHP 내장 함수
  const builtins = [
    'abs', 'floor', 'ceil', 'round', 'min', 'max', 'pow', 'sqrt',
    'strlen', 'substr', 'strpos', 'strtolower', 'strtoupper', 'trim',
    'explode', 'implode', 'str_replace', 'number_format',
    'count', 'array_key_exists', 'in_array', 'array_merge',
    'array_keys', 'array_values',
    'is_numeric', 'is_array', 'is_string', 'is_int', 'is_float',
    'is_bool', 'is_null', 'is_object',
    'json_encode', 'json_decode', 'intdiv', 'var_dump', 'print_r'
  ];
  
  if (builtins.includes(name)) {
    return `php.func("${name}", ${args.join(', ')})`;
  }
  
  // tryUniqueItemLottery 같은 게임 함수들
  if (name === 'tryUniqueItemLottery' || name === 'tryItemLottery') {
    return `await ctx.${name}(${args.join(', ')})`;
  }
  
  // 기타 함수
  return `await php.callFunc("${name}", ${args.join(', ')})`;
}

// ============================================================================
// 기타 표현식
// ============================================================================

export function _new(node: any, ctx: Context, cx: ConvertExpr): string {
  const what = node.what;
  const className = what?.name || 'Unknown';
  const args = (node.arguments || []).map((a: any) => cx(a, ctx));
  
  // 특수 클래스들은 빈 객체로
  if (className === 'LastTurn' || className === 'DateTime') {
    return '{}';
  }
  
  // Exception 계열은 Error로
  if (className.includes('Exception') || className === 'Error') {
    return `new Error(${args.join(', ') || '""'})`;
  }
  
  // ActionLogger 같은 게임 클래스
  if (className === 'ActionLogger' || className === 'Logger') {
    return `await ctx.createLogger(${args.join(', ')})`;
  }
  
  // 기타 클래스 인스턴스
  return `await ctx.createInstance("${className}", ${args.join(', ')})`;
}

export function isset(node: any, ctx: Context, cx: ConvertExpr): string {
  const vars = (node.variables || []).map((v: any) => cx(v, ctx));
  return `php.isset(${vars.join(', ')})`;
}

export function empty(node: any, ctx: Context, cx: ConvertExpr): string {
  const expr = cx(node.expression, ctx);
  return `php.empty(${expr})`;
}

export function cast(node: any, ctx: Context, cx: ConvertExpr): string {
  const what = cx(node.what, ctx);
  const type = node.type;
  
  switch (type) {
    case 'int':
    case 'integer':
      return `php.castInt(${what})`;
    case 'float':
    case 'double':
    case 'real':
      return `php.castFloat(${what})`;
    case 'string':
      return `php.castString(${what})`;
    case 'bool':
    case 'boolean':
      return `php.castBool(${what})`;
    case 'array':
      return `php.castArray(${what})`;
    case 'object':
      return `php.castObject(${what})`;
    default:
      return what;
  }
}

export function silent(node: any, ctx: Context, cx: ConvertExpr): string {
  const expr = cx(node.expr, ctx);
  return `php.silent(() => ${expr})`;
}

export function clone(node: any, ctx: Context, cx: ConvertExpr): string {
  const what = cx(node.what, ctx);
  return `{ ...${what} }`;
}

export function closure(node: any, ctx: Context, cx: ConvertExpr, cs: ConvertStmt): string {
  const params = (node.arguments || []).map((p: any) => p.name || 'arg').join(', ');
  
  return `((${params}) => { /* closure */ })`;
}

export function encapsed(node: any, ctx: Context, cx: ConvertExpr): string {
  // 문자열 보간: "Hello {$name}" → `Hello ${name}`
  const parts = node.value || [];
  
  if (parts.length === 0) return '""';
  
  const converted = parts.map((part: any) => {
    if (part.kind === 'string') {
      // 순수 문자열 부분
      return part.value || '';
    } else if (part.kind === 'encapsedpart') {
      // 보간된 표현식
      if (part.expression) {
        return '${' + cx(part.expression, ctx) + '}';
      }
      return '';
    }
    return '';
  }).join('');
  
  return '`' + converted + '`';
}

export function variadic(node: any, ctx: Context, cx: ConvertExpr): string {
  const what = cx(node.what, ctx);
  return `...${what}`;
}

export function yield_(node: any, ctx: Context, cx: ConvertExpr): string {
  return '/* yield */';
}

export function yieldfrom(node: any, ctx: Context, cx: ConvertExpr): string {
  return '/* yield from */';
}

export function list(node: any, ctx: Context, cx: ConvertExpr): string {
  // list($a, $b) = expr 형태에서 사용됨
  // 단독으로는 의미 없으므로 빈 값 반환
  return 'null';
}

export function print(node: any, ctx: Context, cx: ConvertExpr): string {
  const expr = cx(node.expression, ctx);
  return `console.log(${expr})`;
}

export function include(node: any, ctx: Context, cx: ConvertExpr): string {
  return 'null /* include */';
}

export function eval_(node: any, ctx: Context, cx: ConvertExpr): string {
  return 'null /* eval */';
}

export function exit_(node: any, ctx: Context, cx: ConvertExpr): string {
  return 'throw new Error("exit")';
}

export function typereference(node: any, ctx: Context): string {
  return `/* type: ${node.name || 'unknown'} */`;
}

export function namedargument(node: any, ctx: Context, cx: ConvertExpr): string {
  const value = cx(node.value, ctx);
  return value;
}

export function match(node: any, ctx: Context, cx: ConvertExpr, cs: ConvertStmt): string {
  const cond = cx(node.cond, ctx);
  const arms = (node.arms || []).map((arm: any) => {
    const conds = (arm.conds || []).map((c: any) => cx(c, ctx));
    const body = cx(arm.body, ctx);
    return `{ conds: [${conds.join(', ')}], body: () => ${body} }`;
  });
  
  return `php.match(${cond}, [${arms.join(', ')}])`;
}

export function matcharm(node: any, ctx: Context, cx: ConvertExpr): string {
  // match 내부에서 처리
  return '/* matcharm */';
}

// ============================================================================
// 핸들러 레지스트리
// ============================================================================

export const exprHandlers: Record<string, ExprHandler> = {
  // 리터럴
  number,
  string,
  boolean,
  nullkeyword,
  magic,
  
  // 변수
  variable,
  identifier,
  name,
  selfreference,
  staticreference,
  parentreference,
  
  // Lookup
  propertylookup,
  nullsafepropertylookup,
  offsetlookup,
  staticlookup,
  
  // 연산자
  bin,
  unary,
  post,
  pre,
  assign,
  assignref,
  retif,
  coalesce,
  
  // 배열
  array,
  entry,
  
  // 호출
  call,
  new: _new,
  
  // 기타
  isset,
  empty,
  cast,
  silent,
  clone,
  closure,
  encapsed,
  variadic,
  yield: yield_,
  yieldfrom,
  list,
  print,
  include,
  eval: eval_,
  exit: exit_,
  typereference,
  namedargument,
  match,
  matcharm,
};

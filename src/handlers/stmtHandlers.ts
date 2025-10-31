/**
 * 문장 노드 핸들러
 * 
 * 모든 문장 노드를 처리 (절대 빠뜨리지 않음)
 */

import type { ConvertExpr, ConvertStmt, Context } from './exprHandlers';

export interface StmtHandler {
  (node: any, ctx: Context, convertExpr: ConvertExpr, convertStmt: ConvertStmt, indent: string): string;
}

// ============================================================================
// 표현식 문
// ============================================================================

export function expressionstatement(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  if (!node.expression) return '';
  
  const expr = cx(node.expression, ctx);
  
  // 빈 결과나 null은 생략
  if (!expr || expr === '' || expr === 'null' || expr.includes('/* call */')) {
    return '';
  }
  
  // 불필요한 재할당 제거: (db = db), (general = ctx.generalObj) 등
  const uselessAssignments = [
    '(db = db)',
    '(general = ctx.generalObj)',
    '(city = city)',
    '(nation = nation)',
    '(env = ctx.env)',
    '(arg = arg)',
  ];
  
  if (uselessAssignments.includes(expr)) {
    return '';
  }
  
  return `${indent}${expr};`;
}

// ============================================================================
// 블록
// ============================================================================

export function block(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  const children = node.children || [];
  let code = '';
  
  for (const child of children) {
    const stmt = cs(child, ctx, indent);
    if (stmt) {
      code += stmt + '\n';
    }
  }
  
  return code;
}

export function program(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  return block(node, ctx, cx, cs, indent);
}

// ============================================================================
// 조건문 - if
// ============================================================================

export function if_(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  const test = cx(node.test, ctx);
  let code = `${indent}if (php.bool(${test})) {\n`;
  
  // then 부분
  if (node.body) {
    if (node.body.kind === 'block') {
      code += block(node.body, ctx, cx, cs, indent + '  ');
    } else {
      code += cs(node.body, ctx, indent + '  ') + '\n';
    }
  }
  
  code += `${indent}}`;
  
  // else 부분
  if (node.alternate) {
    if (node.alternate.kind === 'if') {
      // else if
      code += ' else ' + if_(node.alternate, ctx, cx, cs, indent).substring(indent.length);
    } else {
      code += ` else {\n`;
      if (node.alternate.kind === 'block') {
        code += block(node.alternate, ctx, cx, cs, indent + '  ');
      } else {
        const altChildren = node.alternate.children || [node.alternate];
        for (const child of altChildren) {
          code += cs(child, ctx, indent + '  ') + '\n';
        }
      }
      code += `${indent}}`;
    }
  }
  
  return code;
}

// ============================================================================
// 반복문 - for, foreach, while, do
// ============================================================================

export function for_(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  const init = (node.init || []).map((i: any) => cx(i, ctx)).filter((s: string) => s).join(', ');
  const test = (node.test || []).map((t: any) => cx(t, ctx)).filter((s: string) => s).join(', ');
  const increment = (node.increment || []).map((i: any) => cx(i, ctx)).filter((s: string) => s).join(', ');
  
  let code = `${indent}for (${init}; ${test}; ${increment}) {\n`;
  
  if (node.body) {
    if (node.body.kind === 'block') {
      code += block(node.body, ctx, cx, cs, indent + '  ');
    } else {
      code += cs(node.body, ctx, indent + '  ') + '\n';
    }
  }
  
  code += `${indent}}`;
  return code;
}

export function foreach(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  const source = cx(node.source, ctx);
  const key = node.key ? cx(node.key, ctx) : '__k';
  const value = node.value ? cx(node.value, ctx) : 'v';
  
  let code = `${indent}php.foreach(${source}, (${key}, ${value}) => {\n`;
  
  if (node.body) {
    if (node.body.kind === 'block') {
      code += block(node.body, ctx, cx, cs, indent + '  ');
    } else {
      code += cs(node.body, ctx, indent + '  ') + '\n';
    }
  }
  
  code += `${indent}});`;
  return code;
}

export function while_(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  const test = cx(node.test, ctx);
  
  let code = `${indent}while (php.bool(${test})) {\n`;
  
  if (node.body) {
    if (node.body.kind === 'block') {
      code += block(node.body, ctx, cx, cs, indent + '  ');
    } else {
      code += cs(node.body, ctx, indent + '  ') + '\n';
    }
  }
  
  code += `${indent}}`;
  return code;
}

export function do_(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  const test = cx(node.test, ctx);
  
  let code = `${indent}do {\n`;
  
  if (node.body) {
    if (node.body.kind === 'block') {
      code += block(node.body, ctx, cx, cs, indent + '  ');
    } else {
      code += cs(node.body, ctx, indent + '  ') + '\n';
    }
  }
  
  code += `${indent}} while (php.bool(${test}));`;
  return code;
}

// ============================================================================
// switch/case
// ============================================================================

export function switch_(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  const test = cx(node.test, ctx);
  
  let code = `${indent}switch (${test}) {\n`;
  
  if (node.body?.children) {
    for (const child of node.body.children) {
      if (child.kind === 'case') {
        code += case_(child, ctx, cx, cs, indent + '  ') + '\n';
      }
    }
  }
  
  code += `${indent}}`;
  return code;
}

export function case_(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  let code = '';
  
  if (node.test === null) {
    // default
    code += `${indent}default:\n`;
  } else {
    const test = cx(node.test, ctx);
    code += `${indent}case ${test}:\n`;
  }
  
  if (node.body) {
    if (node.body.kind === 'block') {
      code += block(node.body, ctx, cx, cs, indent + '  ');
    } else {
      code += cs(node.body, ctx, indent + '  ') + '\n';
    }
  }
  
  return code;
}

// ============================================================================
// 제어 흐름 - return, break, continue
// ============================================================================

export function return_(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  const expr = node.expr ? cx(node.expr, ctx) : 'true';
  return `${indent}return ${expr};`;
}

export function break_(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  const level = node.level ? cx(node.level, ctx) : null;
  // PHP의 break N은 JavaScript에서 지원 안됨
  if (level && level !== '1') {
    return `${indent}break; /* break ${level} in PHP */`;
  }
  return `${indent}break;`;
}

export function continue_(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  const level = node.level ? cx(node.level, ctx) : null;
  // PHP의 continue N은 JavaScript에서 지원 안됨
  if (level && level !== '1') {
    return `${indent}continue; /* continue ${level} in PHP */`;
  }
  return `${indent}continue;`;
}

export function goto(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  return `${indent}/* goto ${node.label || 'label'} */`;
}

export function label(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  return `${indent}/* label: ${node.name || 'label'} */`;
}

// ============================================================================
// 예외 처리 - try, catch, throw
// ============================================================================

export function try_(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  let code = `${indent}try {\n`;
  
  if (node.body) {
    if (node.body.kind === 'block') {
      code += block(node.body, ctx, cx, cs, indent + '  ');
    } else {
      code += cs(node.body, ctx, indent + '  ') + '\n';
    }
  }
  
  code += `${indent}}`;
  
  // catch 블록들
  if (node.catches) {
    for (const catchBlock of node.catches) {
      const varName = catchBlock.variable?.name || 'e';
      code += ` catch (${varName}) {\n`;
      
      if (catchBlock.body) {
        if (catchBlock.body.kind === 'block') {
          code += block(catchBlock.body, ctx, cx, cs, indent + '  ');
        } else {
          code += cs(catchBlock.body, ctx, indent + '  ') + '\n';
        }
      }
      
      code += `${indent}}`;
    }
  }
  
  // finally 블록
  if (node.always) {
    code += ` finally {\n`;
    
    if (node.always.kind === 'block') {
      code += block(node.always, ctx, cx, cs, indent + '  ');
    } else {
      code += cs(node.always, ctx, indent + '  ') + '\n';
    }
    
    code += `${indent}}`;
  }
  
  return code;
}

export function throw_(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  const what = node.what ? cx(node.what, ctx) : 'new Error("error")';
  return `${indent}throw ${what};`;
}

// ============================================================================
// 기타
// ============================================================================

export function noop(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  return ''; // 빈 문장
}

export function echo(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  const expressions = (node.expressions || []).map((e: any) => cx(e, ctx));
  return `${indent}console.log(${expressions.join(', ')});`;
}

export function inline(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  return `${indent}/* inline html */`;
}

export function declare(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  return `${indent}/* declare */`;
}

export function global(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  const items = (node.items || []).map((i: any) => cx(i, ctx));
  return `${indent}/* global ${items.join(', ')} */`;
}

export function static_(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  const items = (node.items || []).map((i: any) => cx(i, ctx));
  return `${indent}/* static ${items.join(', ')} */`;
}

export function namespace(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  return `${indent}/* namespace */`;
}

export function usegroup(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  return `${indent}/* use */`;
}

export function traituse(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  return `${indent}/* trait use */`;
}

export function constant(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  return `${indent}/* constant */`;
}

export function classconstant(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  return `${indent}/* class constant */`;
}

export function property(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  return `${indent}/* property */`;
}

export function method(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  return `${indent}/* method */`;
}

export function function_(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  return `${indent}/* function */`;
}

export function class_(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  return `${indent}/* class */`;
}

export function interface_(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  return `${indent}/* interface */`;
}

export function trait(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  return `${indent}/* trait */`;
}

export function enum_(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  return `${indent}/* enum */`;
}

export function halt(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  return `${indent}/* __halt_compiler */`;
}

export function unset(
  node: any,
  ctx: Context,
  cx: ConvertExpr,
  cs: ConvertStmt,
  indent: string
): string {
  const variables = (node.variables || []).map((v: any) => cx(v, ctx));
  return `${indent}delete ${variables.join('; delete ')};`;
}

// ============================================================================
// 핸들러 레지스트리
// ============================================================================

export const stmtHandlers: Record<string, StmtHandler> = {
  // 표현식 문
  expressionstatement,
  
  // 블록
  block,
  program,
  
  // 조건문
  if: if_,
  
  // 반복문
  for: for_,
  foreach,
  while: while_,
  do: do_,
  
  // switch
  switch: switch_,
  case: case_,
  
  // 제어 흐름
  return: return_,
  break: break_,
  continue: continue_,
  goto,
  label,
  
  // 예외 처리
  try: try_,
  throw: throw_,
  
  // 기타
  noop,
  echo,
  inline,
  declare,
  global,
  static: static_,
  namespace,
  usegroup,
  traituse,
  constant,
  classconstant,
  property,
  method,
  function: function_,
  class: class_,
  interface: interface_,
  trait,
  enum: enum_,
  halt,
  unset,
};

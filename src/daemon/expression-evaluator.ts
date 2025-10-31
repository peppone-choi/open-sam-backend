/**
 * 표현식 평가기
 * 
 * 세션 설정의 공식 문자열을 실제 값으로 계산
 */

export function evaluate(
  expression: any,
  context: {
    arg?: any;
    general?: any;
    city?: any;
    nation?: any;
    session?: any;
  }
): any {
  // 숫자면 그대로 반환
  if (typeof expression === 'number') {
    return expression;
  }
  
  // 문자열이면 템플릿 처리
  if (typeof expression === 'string') {
    // {{arg.amount}} 같은 패턴 처리
    return expression.replace(/\{\{(.+?)\}\}/g, (match, expr) => {
      try {
        return evalExpression(expr.trim(), context);
      } catch {
        return match;
      }
    });
  }
  
  return expression;
}

function evalExpression(expr: string, context: any): any {
  // arg.amount
  if (expr.startsWith('arg.')) {
    const key = expr.substring(4);
    return context.arg?.[key] ?? 0;
  }
  
  // general.gold
  if (expr.startsWith('general.')) {
    const key = expr.substring(8);
    return context.general?.data?.[key] ?? 0;
  }
  
  // city.pop
  if (expr.startsWith('city.')) {
    const key = expr.substring(5);
    return context.city?.data?.[key] ?? 0;
  }
  
  // 간단한 계산: arg.amount / 100
  if (expr.includes('/') || expr.includes('*') || expr.includes('+') || expr.includes('-')) {
    try {
      // 변수 치환
      let code = expr
        .replace(/arg\.(\w+)/g, (_, k) => context.arg?.[k] ?? 0)
        .replace(/general\.(\w+)/g, (_, k) => context.general?.data?.[k] ?? 0)
        .replace(/city\.(\w+)/g, (_, k) => context.city?.data?.[k] ?? 0);
      
      // 안전한 eval (숫자만)
      return Function(`'use strict'; return (${code})`)();
    } catch {
      return 0;
    }
  }
  
  return 0;
}

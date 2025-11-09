/**
 * 범용 게임 엔진 - FormulaParser
 * 액션 효과 및 비용 계산을 위한 수식 파서
 */

import { Entity } from './Entity';

export interface FormulaContext {
  entity?: Entity;
  stats?: Record<string, number>;
  resources?: Record<string, number>;
  location?: Record<string, any>;
  env?: Record<string, any>;
  [key: string]: any;
}

/**
 * FormulaParser 클래스
 * 문자열 수식을 파싱하고 평가
 */
export class FormulaParser {
  /**
   * 수식 문자열을 평가하여 숫자 반환
   * @param formula 수식 문자열 (예: "stats.intel * 0.7 + random(10, 50)")
   * @param context 평가 컨텍스트 (entity, stats, resources, location, env 등)
   */
  static evaluate(formula: string, context: FormulaContext): number {
    try {
      // 빈 문자열이거나 숫자만 있는 경우
      if (!formula || formula.trim() === '') {
        return 0;
      }

      const trimmed = formula.trim();
      const asNumber = Number(trimmed);
      if (!isNaN(asNumber)) {
        return asNumber;
      }

      // 컨텍스트 변수 준비
      const evalContext = this.prepareContext(context);

      // 수식 변환 (random 함수, 변수 참조 등)
      const transformed = this.transformFormula(formula, evalContext);

      // 안전한 평가
      const result = this.safeEval(transformed, evalContext);

      return typeof result === 'number' ? result : 0;
    } catch (error) {
      console.error(`Formula evaluation error: ${formula}`, error);
      return 0;
    }
  }

  /**
   * 컨텍스트 준비
   */
  private static prepareContext(context: FormulaContext): Record<string, any> {
    const prepared: Record<string, any> = {};

    // entity가 있으면 stats와 resources를 자동으로 추출
    if (context.entity) {
      prepared.stats = context.entity.getAllStats();
      prepared.resources = context.entity.getAllResources();
    }

    // 나머지 컨텍스트 병합
    Object.assign(prepared, context);

    return prepared;
  }

  /**
   * 수식 변환
   */
  private static transformFormula(formula: string, context: Record<string, any>): string {
    let transformed = formula;

    // random(min, max) 함수 처리
    transformed = transformed.replace(/random\((\d+),\s*(\d+)\)/g, (match, min, max) => {
      const minNum = Number(min);
      const maxNum = Number(max);
      const randomValue = Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum;
      return String(randomValue);
    });

    // 변수 참조 처리 (stats.intel, resources.gold, env.develcost 등)
    transformed = this.replaceVariableReferences(transformed, context);

    return transformed;
  }

  /**
   * 변수 참조를 실제 값으로 치환
   */
  private static replaceVariableReferences(formula: string, context: Record<string, any>): string {
    let result = formula;

    // stats.XXX 패턴
    result = result.replace(/stats\.(\w+)/g, (match, statName) => {
      const value = context.stats?.[statName];
      return value !== undefined ? String(value) : '0';
    });

    // resources.XXX 패턴
    result = result.replace(/resources\.(\w+)/g, (match, resourceName) => {
      const value = context.resources?.[resourceName];
      return value !== undefined ? String(value) : '0';
    });

    // location.XXX 패턴
    result = result.replace(/location\.(\w+)/g, (match, locationProp) => {
      const value = context.location?.[locationProp];
      return value !== undefined ? String(value) : '0';
    });

    // env.XXX 패턴
    result = result.replace(/env\.(\w+)/g, (match, envVar) => {
      const value = context.env?.[envVar];
      return value !== undefined ? String(value) : '0';
    });

    return result;
  }

  /**
   * 안전한 수식 평가 (eval 대신 Function 사용)
   */
  private static safeEval(expression: string, context: Record<string, any>): number {
    try {
      // 허용된 연산자만 포함하는지 검증
      if (!this.isSafeExpression(expression)) {
        throw new Error(`Unsafe expression: ${expression}`);
      }

      // Function을 사용한 안전한 평가
      const func = new Function(...Object.keys(context), `return (${expression});`);
      const result = func(...Object.values(context));

      return typeof result === 'number' ? result : Number(result);
    } catch (error) {
      console.error(`Safe eval error: ${expression}`, error);
      return 0;
    }
  }

  /**
   * 수식 안전성 검증
   */
  private static isSafeExpression(expression: string): boolean {
    // 허용된 문자: 숫자, 연산자, 괄호, 점, 공백
    const safePattern = /^[\d\s+\-*/.()]+$/;
    return safePattern.test(expression);
  }

  /**
   * 비용 계산 (costs 객체 평가)
   */
  static evaluateCosts(
    costs: Record<string, string> | undefined,
    context: FormulaContext
  ): Record<string, number> {
    if (!costs) {
      return {};
    }

    const result: Record<string, number> = {};

    for (const [resourceId, formula] of Object.entries(costs)) {
      result[resourceId] = this.evaluate(formula, context);
    }

    return result;
  }

  /**
   * 경험치 계산 (experience 객체 평가)
   */
  static evaluateExperience(
    experience: Record<string, number | string> | undefined,
    context: FormulaContext
  ): Record<string, number> {
    if (!experience) {
      return {};
    }

    const result: Record<string, number> = {};

    for (const [statId, value] of Object.entries(experience)) {
      if (typeof value === 'number') {
        result[statId] = value;
      } else {
        result[statId] = this.evaluate(value, context);
      }
    }

    return result;
  }
}

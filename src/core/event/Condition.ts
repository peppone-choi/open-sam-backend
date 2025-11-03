/**
 * 이벤트 조건 추상 클래스
 * PHP Condition과 동일한 구조
 */
export abstract class Condition {
  /**
   * 조건 평가
   * @param env 게임 환경 변수
   * @returns 평가 결과 { value: boolean, chain: string[] }
   */
  public abstract eval(env?: any): { value: boolean; chain: string[] };

  /**
   * 조건 빌드
   * @param conditionChain 조건 체인
   * @returns Condition 인스턴스
   */
  public static build(conditionChain: any): Condition | boolean {
    // boolean인 경우
    if (typeof conditionChain === 'boolean') {
      return new ConstBool(conditionChain);
    }

    // 배열이 아닌 경우
    if (!Array.isArray(conditionChain)) {
      return conditionChain as Condition;
    }

    const key = conditionChain[0];

    // Logic 단축 명령 처리
    const LogicModule = require('./Condition/Logic');
    const AVAILABLE_LOGIC_NAME = LogicModule.AVAILABLE_LOGIC_NAME || {};
    if (key && typeof key === 'string' && AVAILABLE_LOGIC_NAME[key.toLowerCase()]) {
      const LogicClass = LogicModule.Logic || LogicModule.default;
      if (LogicClass) {
        return new LogicClass(...conditionChain);
      }
    }

    // 특정 Condition 클래스 찾기
    try {
      let ConditionModule: any;
      let ConditionClass: any;

      // 주요 Condition 타입들 직접 매핑
      switch (key) {
        case 'Date':
          ConditionModule = require('./Condition/Date');
          ConditionClass = ConditionModule.Date;
          break;
        case 'DateRelative':
          ConditionModule = require('./Condition/DateRelative');
          ConditionClass = ConditionModule.DateRelative;
          break;
        case 'Interval':
          ConditionModule = require('./Condition/Interval');
          ConditionClass = ConditionModule.Interval;
          break;
        case 'RemainNation':
          ConditionModule = require('./Condition/RemainNation');
          ConditionClass = ConditionModule.RemainNation;
          break;
        default:
          ConditionModule = require(`./Condition/${key}`);
          ConditionClass = ConditionModule[key] || ConditionModule.default;
      }

      if (ConditionClass) {
        const args: any[] = [];
        for (let i = 1; i < conditionChain.length; i++) {
          args.push(Condition.build(conditionChain[i]));
        }
        return new ConditionClass(...args);
      }
    } catch (error) {
      // Condition 클래스를 찾지 못함 - 배열로 처리
    }

    // 배열의 첫 번째 값이 Condition이 아닌 경우 배열로 처리
    const result: any[] = [];
    for (const condition of conditionChain) {
      result.push(Condition.build(condition));
    }
    return result as any;
  }

  /**
   * 내부 평가 헬퍼
   */
  protected static _eval(arg: any, env?: any): { value: boolean; chain: string[] } {
    if (typeof arg === 'boolean') {
      return {
        value: arg,
        chain: ['boolean']
      };
    }
    if (arg instanceof Condition) {
      return arg.eval(env);
    }
    throw new Error('평가 인자는 boolean이거나 Condition 클래스여야 합니다.');
  }
}

/**
 * 상수 Boolean 조건
 */
export class ConstBool extends Condition {
  constructor(private value: boolean) {
    super();
  }

  eval(env?: any): { value: boolean; chain: string[] } {
    return {
      value: this.value,
      chain: ['boolean']
    };
  }
}


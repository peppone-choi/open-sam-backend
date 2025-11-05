import { Condition } from '../Condition';
import { Nation } from '../../../models/nation.model';

/**
 * 남은 국가 수 조건
 * PHP RemainNation Condition과 동일한 구조
 */
const AVAILABLE_CMP: Record<string, boolean> = {
  '==': true,
  '!=': true,
  '<': true,
  '>': true,
  '<=': true,
  '>=': true,
};

export class RemainNation extends Condition {
  private cmp: string;
  private cnt: number;

  constructor(cmp: string, cnt: number) {
    super();
    
    if (!AVAILABLE_CMP[cmp]) {
      throw new Error('올바르지 않은 비교연산자입니다');
    }

    this.cmp = cmp;
    this.cnt = cnt;
  }

  eval(env?: any): { value: boolean; chain: string[] } {
    if (env === null || env['session_id'] === undefined) {
      return {
        value: false,
        chain: ['RemainNation']
      };
    }

    // 남은 국가 수 조회
    const sessionId = env['session_id'];
    let lhs = 0;
    
    try {
      // 동기적으로 처리하기 위해 캐시된 값을 사용하거나 동기 DB 조회
      // MongoDB의 경우 동기 조회는 불가하므로 환경 변수에서 가져오거나
      // 이전에 계산된 값을 사용
      if (env['remainNationCount'] !== undefined) {
        lhs = env['remainNationCount'];
      } else {
        // 동기 조회가 불가하므로 false 반환
        // 실제 사용 시 환경 변수에 미리 계산된 값을 설정해야 함
        return {
          value: false,
          chain: ['RemainNation', 'not_available']
        };
      }
    } catch (error) {
      return {
        value: false,
        chain: ['RemainNation', 'error']
      };
    }
    const rhs = this.cnt;

    let value = false;
    switch (this.cmp) {
      case '==':
        value = lhs === rhs;
        break;
      case '!=':
        value = lhs !== rhs;
        break;
      case '<=':
        value = lhs <= rhs;
        break;
      case '>=':
        value = lhs >= rhs;
        break;
      case '<':
        value = lhs < rhs;
        break;
      case '>':
        value = lhs > rhs;
        break;
    }

    return {
      value,
      chain: ['RemainNation']
    };
  }
}


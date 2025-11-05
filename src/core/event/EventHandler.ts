import { Condition } from './Condition';
import { Action } from './Action';

/**
 * 이벤트 핸들러
 * PHP EventHandler와 동일한 구조
 */
export class EventHandler {
  private condition: Condition;
  private actions: Action[] = [];

  constructor(rawCondition: any, rawActions: any[]) {
    const builtCondition = Condition.build(rawCondition);
    if (builtCondition instanceof Condition) {
      this.condition = builtCondition;
    } else if (typeof builtCondition === 'boolean') {
      // boolean인 경우 ConstBool로 래핑
      const { ConstBool } = require('./Condition');
      this.condition = new ConstBool(builtCondition);
    } else {
      throw new Error('Invalid condition type');
    }
    
    for (const rawAction of rawActions) {
      this.actions.push(Action.build(rawAction));
    }
  }

  /**
   * 이벤트 실행 시도
   * @param env 게임 환경 변수
   * @returns 실행 결과
   */
  async tryRunEvent(env: any): Promise<any> {
    const result = this.condition.eval(env);

    if (!result.value) {
      return result;
    }

    const resultAction: any[] = [];
    for (const action of this.actions) {
      const actionResult = await action.run(env);
      resultAction.push(actionResult);
    }
    (result as any).action = resultAction;

    return result;
  }
}


/**
 * 이벤트 액션 추상 클래스
 * PHP Action과 동일한 구조
 */
export abstract class Action {
  /**
   * 액션 실행
   * @param env 게임 환경 변수
   * @returns 실행 결과
   */
  public abstract run(env: any): any;

  /**
   * 액션 빌드
   * @param actionArgs 액션 인자 배열 [className, ...args]
   * @returns Action 인스턴스
   */
  public static build(actionArgs: any[]): Action {
    if (!Array.isArray(actionArgs)) {
      throw new Error('action을 입력해야 합니다.');
    }

    if (actionArgs.length === 0) {
      throw new Error('action 클래스명이 필요합니다.');
    }

    const className = actionArgs[0];
    const args = actionArgs.slice(1);

    // 동적 import 시도
    try {
      let ActionModule: any;
      let ActionClass: any;

      // 주요 Action 타입들 직접 매핑
      switch (className) {
        case 'ProcessIncome':
          ActionModule = require('./Action/ProcessIncome');
          ActionClass = ActionModule.ProcessIncome;
          break;
        case 'NewYear':
          ActionModule = require('./Action/NewYear');
          ActionClass = ActionModule.NewYear;
          break;
        case 'RaiseNPCNation':
          ActionModule = require('./Action/RaiseNPCNation');
          ActionClass = ActionModule.RaiseNPCNation;
          break;
        case 'ProcessWarIncome':
          ActionModule = require('./Action/ProcessWarIncome');
          ActionClass = ActionModule.ProcessWarIncome;
          break;
        case 'LostUniqueItem':
          ActionModule = require('./Action/LostUniqueItem');
          ActionClass = ActionModule.LostUniqueItem;
          break;
        case 'RandomizeCityTradeRate':
          ActionModule = require('./Action/RandomizeCityTradeRate');
          ActionClass = ActionModule.RandomizeCityTradeRate;
          break;
        default:
          ActionModule = require(`./Action/${className}`);
          ActionClass = ActionModule[className] || ActionModule.default;
      }

      if (!ActionClass) {
        throw new Error(`존재하지 않는 Action입니다: ${className}`);
      }

      return new ActionClass(...args);
    } catch (error: any) {
      throw new Error(`존재하지 않는 Action입니다: ${className} (${error.message})`);
    }
  }
}


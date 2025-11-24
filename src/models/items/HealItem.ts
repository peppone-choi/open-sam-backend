/**
 * HealItem - 치료 아이템
 * 
 * 참고: core/hwe/sammo/ActionItem/che_치료_환약.php
 */

import { ActionItem } from './ActionItem';
import type { IGeneral } from '../general.model';
import type { RandUtil } from '../../utils/RandUtil';

/**
 * che_치료_환약 - 환약(치료)
 * 턴 실행 전 부상 회복, 3회용
 */
export class che_치료_환약 extends ActionItem {
  protected rawName = '환약';
  protected name = '환약(치료)';
  protected info = '[군사] 턴 실행 전 부상 회복. 3회용';
  protected cost = 200;
  protected consumable = true;
  protected buyable = true;
  protected reqSecu = 0;

  static readonly REMAIN_KEY = 'remain환약';

  /**
   * 턴 실행 전 치료 트리거 반환
   */
  getPreTurnExecuteTriggerList(general: IGeneral): any | null {
    // PHP에서는 GeneralTrigger\che_아이템치료 를 사용
    // TypeScript에서는 트리거 시스템이 구현되면 연결
    const useTreatment = this.getAuxVar(general, 'use_treatment') ?? 10;
    return {
      type: 'che_아이템치료',
      amount: useTreatment
    };
  }

  /**
   * 구매 시 남은 횟수 초기화
   */
  onArbitraryAction(
    general: IGeneral,
    rng: RandUtil,
    actionType: string,
    phase: string | null = null,
    aux: any = null
  ): any {
    if (actionType !== '장비매매') {
      return aux;
    }
    if (phase !== '구매') {
      return aux;
    }

    this.setAuxVar(general, che_치료_환약.REMAIN_KEY, 3);
    return aux;
  }

  /**
   * 치료 트리거 발동 시 소비 처리
   */
  tryConsumeNow(general: IGeneral, actionType: string, command: string): boolean {
    if (actionType !== 'GeneralTrigger') {
      return false;
    }
    if (command !== 'che_아이템치료') {
      return false;
    }

    const remainCnt = this.getAuxVar(general, che_치료_환약.REMAIN_KEY) ?? 1;
    if (remainCnt > 1) {
      this.setAuxVar(general, che_치료_환약.REMAIN_KEY, remainCnt - 1);
      return false;
    }

    // 마지막 사용 -> 아이템 제거
    this.setAuxVar(general, che_치료_환약.REMAIN_KEY, null);
    return true;
  }
}

/**
 * che_치료_정력견혈 - 정력견혈산(치료)
 */
export class che_치료_정력견혈 extends ActionItem {
  protected rawName = '정력견혈산';
  protected name = '정력견혈산(치료)';
  protected info = '[군사] 부상 회복률 +50%p';
  protected cost = 200;
  protected consumable = false;

  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    if (turnType === '치료' && varType === 'recovery_rate') {
      return value + 0.5;
    }
    return value;
  }
}

/**
 * che_의술_상한잡병론 - 상한잡병론(의술)
 */
export class che_의술_상한잡병론 extends ActionItem {
  protected rawName = '상한잡병론';
  protected name = '상한잡병론(의술)';
  protected info = '[의술] 치료 성공률 +30%p, 치료량 +30%';
  protected cost = 200;
  protected consumable = false;

  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    if (turnType === '치료') {
      if (varType === 'success_rate') {
        return value + 0.3;
      }
      if (varType === 'amount') {
        return value * 1.3;
      }
    }
    return value;
  }
}

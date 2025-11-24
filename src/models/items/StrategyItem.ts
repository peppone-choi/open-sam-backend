/**
 * StrategyItem - 계략 아이템
 * 
 * 참고: core/hwe/sammo/ActionItem/che_계략_*.php
 */

import { ActionItem } from './ActionItem';
import type { IGeneral } from '../general.model';

/**
 * che_계략_삼략 - 삼략(계략)
 * 화계·탈취·파괴·선동 성공률 +20%p, 전투 계략 시도/성공 확률 +10%p
 */
export class che_계략_삼략 extends ActionItem {
  protected rawName = '삼략';
  protected name = '삼략(계략)';
  protected info = '[계략] 화계·탈취·파괴·선동 : 성공률 +20%p<br>[전투] 계략 시도 확률 +10%p, 계략 성공 확률 +10%p';
  protected cost = 200;
  protected consumable = false;

  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    if (turnType === '계략') {
      if (varType === 'success') {
        return value + 0.2;
      }
    }
    return value;
  }

  onCalcStat(general: IGeneral, statName: string, value: any, aux?: any): any {
    if (statName === 'warMagicTrialProb') {
      return value + 0.1;
    }
    if (statName === 'warMagicSuccessProb') {
      return value + 0.1;
    }
    return value;
  }
}

/**
 * che_계략_육도 - 육도(계략)
 */
export class che_계략_육도 extends ActionItem {
  protected rawName = '육도';
  protected name = '육도(계략)';
  protected info = '[계략] 화계·탈취·파괴·선동 : 성공률 +15%p';
  protected cost = 150;
  protected consumable = false;

  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    if (turnType === '계략' && varType === 'success') {
      return value + 0.15;
    }
    return value;
  }
}

/**
 * che_계략_이추 - 이추(계략)
 */
export class che_계략_이추 extends ActionItem {
  protected rawName = '이추';
  protected name = '이추(계략)';
  protected info = '[계략] 화계·탈취·파괴·선동 : 성공률 +10%p';
  protected cost = 100;
  protected consumable = false;

  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    if (turnType === '계략' && varType === 'success') {
      return value + 0.1;
    }
    return value;
  }
}

/**
 * BuffItem - 버프 아이템
 * 
 * 참고: core/hwe/sammo/ActionItem/che_능력치_*.php, che_훈련_*.php
 */

import { ActionItem } from './ActionItem';
import type { IGeneral } from '../general.model';

/**
 * che_능력치_무력_두강주 - 두강주(무력)
 * 무력 +5 +(4년마다 +1)
 */
export class che_능력치_무력_두강주 extends ActionItem {
  protected rawName = '두강주';
  protected name = '두강주(무력)';
  protected info = '[능력치] 무력 +5 +(4년마다 +1)';
  protected cost = 200;
  protected consumable = false;

  onCalcStat(general: IGeneral, statName: string, value: any, aux?: any): any {
    if (statName === 'strength') {
      // 게임 연도 계산 (환경 정보가 필요한 경우)
      // 현재는 기본 +5만 적용
      const baseBonus = 5;
      // TODO: 게임 연도 기반 추가 보너스 계산
      // const yearBonus = Math.floor((currentYear - startYear) / 4);
      return value + baseBonus;
    }
    return value;
  }
}

/**
 * che_능력치_지력_이강주 - 이강주(지력)
 * 지력 +5 +(4년마다 +1)
 */
export class che_능력치_지력_이강주 extends ActionItem {
  protected rawName = '이강주';
  protected name = '이강주(지력)';
  protected info = '[능력치] 지력 +5 +(4년마다 +1)';
  protected cost = 200;
  protected consumable = false;

  onCalcStat(general: IGeneral, statName: string, value: any, aux?: any): any {
    if (statName === 'intel') {
      return value + 5;
    }
    return value;
  }
}

/**
 * che_능력치_통솔_보령압주 - 보령압주(통솔)
 * 통솔 +5 +(4년마다 +1)
 */
export class che_능력치_통솔_보령압주 extends ActionItem {
  protected rawName = '보령압주';
  protected name = '보령압주(통솔)';
  protected info = '[능력치] 통솔 +5 +(4년마다 +1)';
  protected cost = 200;
  protected consumable = false;

  onCalcStat(general: IGeneral, statName: string, value: any, aux?: any): any {
    if (statName === 'leadership') {
      return value + 5;
    }
    return value;
  }
}

/**
 * che_훈련_과실주 - 과실주(훈련)
 * 전투 훈련 보정 +10
 */
export class che_훈련_과실주 extends ActionItem {
  protected rawName = '과실주';
  protected name = '과실주(훈련)';
  protected info = '[전투] 훈련 보정 +10';
  protected cost = 200;
  protected consumable = false;

  onCalcStat(general: IGeneral, statName: string, value: any, aux?: any): any {
    if (statName === 'bonusTrain') {
      return value + 10;
    }
    return value;
  }
}

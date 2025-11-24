/**
 * BattleItem - 전투 아이템
 * 
 * 참고: core/hwe/sammo/ActionItem/che_사기_*.php
 */

import { ActionItem } from './ActionItem';
import type { IGeneral } from '../general.model';

/**
 * che_사기_탁주 - 탁주(사기)
 * 전투 시 사기 +30 (한도 내), 1회용
 */
export class che_사기_탁주 extends ActionItem {
  protected rawName = '탁주';
  protected name = '탁주(사기)';
  protected info = '[전투] 사기 +30(한도 내). 1회용';
  protected cost = 1000;
  protected consumable = true;
  protected buyable = true;
  protected reqSecu = 1000;

  /**
   * 전투 초기화 시 사기 증가 트리거 반환
   */
  getBattleInitSkillTriggerList(unit: any): any | null {
    // PHP: new 능력치변경($unit, BaseWarUnitTrigger::TYPE_CONSUMABLE_ITEM, 'atmos', '+', 30, null, GameConst::$maxAtmosByWar)
    return {
      type: 'stat_change',
      triggerType: 'consumable_item',
      stat: 'atmos',
      operation: '+',
      value: 30,
      max: 100 // GameConst::$maxAtmosByWar
    };
  }
}

/**
 * che_사기_초선화 - 초선화(사기)
 * 전투 시 사기 +50 (한도 내), 1회용
 */
export class che_사기_초선화 extends ActionItem {
  protected rawName = '초선화';
  protected name = '초선화(사기)';
  protected info = '[전투] 사기 +50(한도 내). 1회용';
  protected cost = 2000;
  protected consumable = true;
  protected buyable = true;
  protected reqSecu = 2000;

  getBattleInitSkillTriggerList(unit: any): any | null {
    return {
      type: 'stat_change',
      triggerType: 'consumable_item',
      stat: 'atmos',
      operation: '+',
      value: 50,
      max: 100
    };
  }
}

/**
 * che_농성_위공자병법 - 위공자병법(농성)
 * 농성전 방어력 +20%
 */
export class che_농성_위공자병법 extends ActionItem {
  protected rawName = '위공자병법';
  protected name = '위공자병법(농성)';
  protected info = '[농성] 농성전 방어력 +20%';
  protected cost = 200;
  protected consumable = false;

  onCalcStat(general: IGeneral, statName: string, value: any, aux?: any): any {
    if (statName === 'siegeDefense') {
      return value * 1.2;
    }
    return value;
  }
}

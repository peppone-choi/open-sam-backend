/**
 * Battle items – trimmed representatives for 전투 계통.
 */

import { ActionItem } from './ActionItem';
import type { IGeneral } from '../general.model';

/**
 * che_사기_탁주 – 전투 시작 시 사기 +30 (한도 내).
 */
export class che_사기_탁주 extends ActionItem {
  protected rawName = '탁주';
  protected name = '탁주(사기)';
  protected info = '[전투] 사기 +30(한도 내). 1회용';
  protected cost = 1000;
  protected consumable = true;
  protected buyable = true;
  protected reqSecu = 1000;

  getBattleInitSkillTriggerList(_unit: any): any | null {
    return {
      type: 'stat_change',
      triggerType: 'consumable_item',
      stat: 'atmos',
      operation: '+',
      value: 30,
      max: 100,
    };
  }
}

/**
 * che_농성_위공자병법 – 농성전 방어력 +20%.
 */
export class che_농성_위공자병법 extends ActionItem {
  protected rawName = '위공자병법';
  protected name = '위공자병법(농성)';
  protected info = '[농성] 농성전 방어력 +20%';
  protected cost = 200;
  protected consumable = false;

  onCalcStat(_general: IGeneral, statName: string, value: any, _aux?: any): any {
    if (statName === 'siegeDefense') {
      return value * 1.2;
    }
    return value;
  }
}

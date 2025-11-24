/**
 * Ability buff items – trimmed representatives for 능력치 계통.
 */

import { ActionItem } from './ActionItem';
import type { IGeneral } from '../general.model';

/**
 * che_능력치_무력_두강주 – 무력 +5.
 */
export class che_능력치_무력_두강주 extends ActionItem {
  protected rawName = '두강주';
  protected name = '두강주(무력)';
  protected info = '[능력치] 무력 +5';
  protected cost = 200;
  protected consumable = false;

  onCalcStat(_general: IGeneral, statName: string, value: any, _aux?: any): any {
    if (statName === 'strength') {
      return value + 5;
    }
    return value;
  }
}

/**
 * che_능력치_지력_이강주 – 지력 +5.
 */
export class che_능력치_지력_이강주 extends ActionItem {
  protected rawName = '이강주';
  protected name = '이강주(지력)';
  protected info = '[능력치] 지력 +5';
  protected cost = 200;
  protected consumable = false;

  onCalcStat(_general: IGeneral, statName: string, value: any, _aux?: any): any {
    if (statName === 'intel') {
      return value + 5;
    }
    return value;
  }
}

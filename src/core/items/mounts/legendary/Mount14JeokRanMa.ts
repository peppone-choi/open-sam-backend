/**
 * 적란마 (등급 14)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_14_적란마.php
 */

import { BasicMount } from '../MountBase';

/**
 * 적란마 - 붉은 갈기의 전설적인 명마
 * 통솔 +14
 */
export class Mount14JeokRanMa extends BasicMount {
  readonly code = 'che_명마_14_적란마';
  readonly rawName = '적란마';
  readonly statValue = 14;

  protected _cost = 200;
  protected _buyable = false;
}



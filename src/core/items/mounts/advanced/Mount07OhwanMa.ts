/**
 * 오환마 (등급 7)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_07_오환마.php
 */

import { BasicMount } from '../MountBase';

/**
 * 오환마 - 오환족의 준마
 * 통솔 +7
 */
export class Mount07OhwanMa extends BasicMount {
  readonly code = 'che_명마_07_오환마';
  readonly rawName = '오환마';
  readonly statValue = 7;

  protected _cost = 200;
  protected _buyable = false;
}



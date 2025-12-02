/**
 * 옥추마 (등급 10)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_10_옥추마.php
 */

import { BasicMount } from '../MountBase';

/**
 * 옥추마 - 옥으로 장식된 추마
 * 통솔 +10
 */
export class Mount10OkchuMa extends BasicMount {
  readonly code = 'che_명마_10_옥추마';
  readonly rawName = '옥추마';
  readonly statValue = 10;

  protected _cost = 200;
  protected _buyable = false;
}



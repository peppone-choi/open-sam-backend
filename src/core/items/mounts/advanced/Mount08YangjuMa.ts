/**
 * 양주마 (등급 8)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_08_양주마.php
 */

import { BasicMount } from '../MountBase';

/**
 * 양주마 - 양주 지역의 준마
 * 통솔 +8
 */
export class Mount08YangjuMa extends BasicMount {
  readonly code = 'che_명마_08_양주마';
  readonly rawName = '양주마';
  readonly statValue = 8;

  protected _cost = 200;
  protected _buyable = false;
}



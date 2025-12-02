/**
 * 화종마 (등급 11)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_11_화종마.php
 */

import { BasicMount } from '../MountBase';

/**
 * 화종마 - 화종 지역의 명마
 * 통솔 +11
 */
export class Mount11HwajongMa extends BasicMount {
  readonly code = 'che_명마_11_화종마';
  readonly rawName = '화종마';
  readonly statValue = 11;

  protected _cost = 200;
  protected _buyable = false;
}



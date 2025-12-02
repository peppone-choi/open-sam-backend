/**
 * 의남백마 (등급 9)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_09_의남백마.php
 */

import { BasicMount } from '../MountBase';

/**
 * 의남백마 - 의남 지역의 흰 준마
 * 통솔 +9
 */
export class Mount09UinamBaekMa extends BasicMount {
  readonly code = 'che_명마_09_의남백마';
  readonly rawName = '의남백마';
  readonly statValue = 9;

  protected _cost = 200;
  protected _buyable = false;
}



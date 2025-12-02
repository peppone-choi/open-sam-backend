/**
 * 과하마 (등급 9)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_09_과하마.php
 */

import { BasicMount } from '../MountBase';

/**
 * 과하마 - 과일나무 아래를 지나갈 수 있는 작은 준마
 * 통솔 +9
 */
export class Mount09GwahaMa extends BasicMount {
  readonly code = 'che_명마_09_과하마';
  readonly rawName = '과하마';
  readonly statValue = 9;

  protected _cost = 200;
  protected _buyable = false;
}



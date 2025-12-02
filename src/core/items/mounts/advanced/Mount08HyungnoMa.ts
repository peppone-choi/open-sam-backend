/**
 * 흉노마 (등급 8)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_08_흉노마.php
 */

import { BasicMount } from '../MountBase';

/**
 * 흉노마 - 흉노족의 준마
 * 통솔 +8
 */
export class Mount08HyungnoMa extends BasicMount {
  readonly code = 'che_명마_08_흉노마';
  readonly rawName = '흉노마';
  readonly statValue = 8;

  protected _cost = 200;
  protected _buyable = false;
}



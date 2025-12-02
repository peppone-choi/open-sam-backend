/**
 * 갈색마 (등급 5)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_05_갈색마.php
 */

import { BasicMount } from '../MountBase';

/**
 * 갈색마 - 갈색 털의 준마
 * 통솔 +5
 */
export class Mount05GalsaekMa extends BasicMount {
  readonly code = 'che_명마_05_갈색마';
  readonly rawName = '갈색마';
  readonly statValue = 5;

  protected _cost = 15000;
  protected _buyable = true;
  protected _reqSecu = 5000;
}



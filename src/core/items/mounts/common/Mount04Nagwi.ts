/**
 * 나귀 (등급 4)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_04_나귀.php
 */

import { BasicMount } from '../MountBase';

/**
 * 나귀 - 인내력 있는 당나귀
 * 통솔 +4
 */
export class Mount04Nagwi extends BasicMount {
  readonly code = 'che_명마_04_나귀';
  readonly rawName = '나귀';
  readonly statValue = 4;

  protected _cost = 10000;
  protected _buyable = true;
  protected _reqSecu = 4000;
}



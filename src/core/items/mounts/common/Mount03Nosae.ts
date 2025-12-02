/**
 * 노새 (등급 3)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_03_노새.php
 */

import { BasicMount } from '../MountBase';

/**
 * 노새 - 튼튼한 잡종 말
 * 통솔 +3
 */
export class Mount03Nosae extends BasicMount {
  readonly code = 'che_명마_03_노새';
  readonly rawName = '노새';
  readonly statValue = 3;

  protected _cost = 6000;
  protected _buyable = true;
  protected _reqSecu = 3000;
}



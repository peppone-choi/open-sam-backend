/**
 * 조랑 (등급 2)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_02_조랑.php
 */

import { BasicMount } from '../MountBase';

/**
 * 조랑 - 작고 빠른 조랑말
 * 통솔 +2
 */
export class Mount02Jorang extends BasicMount {
  readonly code = 'che_명마_02_조랑';
  readonly rawName = '조랑';
  readonly statValue = 2;

  protected _cost = 3000;
  protected _buyable = true;
  protected _reqSecu = 2000;
}



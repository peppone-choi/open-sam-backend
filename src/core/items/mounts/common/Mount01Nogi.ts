/**
 * 노기 (등급 1)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_01_노기.php
 */

import { BasicMount } from '../MountBase';

/**
 * 노기 - 가장 기본적인 탈것
 * 통솔 +1
 */
export class Mount01Nogi extends BasicMount {
  readonly code = 'che_명마_01_노기';
  readonly rawName = '노기';
  readonly statValue = 1;

  protected _cost = 1000;
  protected _buyable = true;
  protected _reqSecu = 1000;
}



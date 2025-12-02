/**
 * 적로 (등급 13)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_13_적로.php
 * 유비의 말로 유명
 */

import { BasicMount } from '../MountBase';

/**
 * 적로 - 유비의 전설적인 명마
 * 단계 전투에서 유비를 구한 것으로 유명
 * 통솔 +13
 */
export class Mount13JeokRo extends BasicMount {
  readonly code = 'che_명마_13_적로';
  readonly rawName = '적로';
  readonly statValue = 13;

  protected _cost = 200;
  protected _buyable = false;
}



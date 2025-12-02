/**
 * 절영 (등급 13)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_13_절영.php
 * 조조의 말로 유명
 */

import { BasicMount } from '../MountBase';

/**
 * 절영 - 조조의 전설적인 명마
 * 그림자도 남기지 않을 정도로 빠름
 * 통솔 +13
 */
export class Mount13JeolYoung extends BasicMount {
  readonly code = 'che_명마_13_절영';
  readonly rawName = '절영';
  readonly statValue = 13;

  protected _cost = 200;
  protected _buyable = false;
}



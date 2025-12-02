/**
 * 조황비전 (등급 14)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_14_조황비전.php
 * 손권의 말로 유명
 */

import { BasicMount } from '../MountBase';

/**
 * 조황비전 - 손권의 전설적인 명마
 * 황색 몸에 붉은 갈기, 번개처럼 빠름
 * 통솔 +14
 */
export class Mount14JohwangBijeon extends BasicMount {
  readonly code = 'che_명마_14_조황비전';
  readonly rawName = '조황비전';
  readonly statValue = 14;

  protected _cost = 200;
  protected _buyable = false;
}



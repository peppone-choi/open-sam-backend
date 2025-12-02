/**
 * 서량마 (등급 11)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_11_서량마.php
 */

import { BasicMount } from '../MountBase';

/**
 * 서량마 - 서량 지역의 명마
 * 통솔 +11
 */
export class Mount11SeoryangMa extends BasicMount {
  readonly code = 'che_명마_11_서량마';
  readonly rawName = '서량마';
  readonly statValue = 11;

  protected _cost = 200;
  protected _buyable = false;
}



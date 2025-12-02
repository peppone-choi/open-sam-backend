/**
 * 대완마 (등급 10)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_10_대완마.php
 */

import { BasicMount } from '../MountBase';

/**
 * 대완마 - 대완(페르가나) 지역의 명마
 * 통솔 +10
 */
export class Mount10DaewanMa extends BasicMount {
  readonly code = 'che_명마_10_대완마';
  readonly rawName = '대완마';
  readonly statValue = 10;

  protected _cost = 200;
  protected _buyable = false;
}



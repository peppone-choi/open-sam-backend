/**
 * 한혈마 (등급 15)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_15_한혈마.php
 * 피땀을 흘리는 전설의 명마
 */

import { BasicMount } from '../MountBase';

/**
 * 한혈마 - 피땀을 흘리는 전설적인 명마
 * 대완에서 온 천리마, 달릴 때 피땀을 흘림
 * 통솔 +15
 */
export class Mount15HanHyulMa extends BasicMount {
  readonly code = 'che_명마_15_한혈마';
  readonly rawName = '한혈마';
  readonly statValue = 15;

  protected _cost = 200;
  protected _buyable = false;
}



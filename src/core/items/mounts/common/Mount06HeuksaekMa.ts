/**
 * 흑색마 (등급 6)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_06_흑색마.php
 */

import { BasicMount } from '../MountBase';

/**
 * 흑색마 - 검은 털의 준마
 * 통솔 +6
 */
export class Mount06HeuksaekMa extends BasicMount {
  readonly code = 'che_명마_06_흑색마';
  readonly rawName = '흑색마';
  readonly statValue = 6;

  protected _cost = 21000;
  protected _buyable = true;
  protected _reqSecu = 6000;
}



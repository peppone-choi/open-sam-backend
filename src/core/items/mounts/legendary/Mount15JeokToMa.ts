/**
 * 적토마 (등급 15)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_15_적토마.php
 * 여포, 관우의 말로 유명. 삼국지 최고의 명마
 */

import { BasicMount } from '../MountBase';

/**
 * 적토마 - 삼국지 최고의 전설적인 명마
 * 여포와 관우가 탔던 천리마
 * "사람 중에 여포, 말 중에 적토마"
 * 통솔 +15
 */
export class Mount15JeokToMa extends BasicMount {
  readonly code = 'che_명마_15_적토마';
  readonly rawName = '적토마';
  readonly statValue = 15;

  protected _cost = 200;
  protected _buyable = false;
}



/**
 * 정복 (征服) - 성격
 * PHP che_정복.php 기반
 * 
 * 효과:
 * - 명성(경험치) -10%
 * - 사기 +5
 */

import { PersonalityBase, IStatCalcContext } from './PersonalityBase';

export class Jeongbok extends PersonalityBase {
  readonly id = 4;
  readonly name = '정복';
  readonly info = '명성 -10%, 사기 +5';

  override onCalcStat(ctx: IStatCalcContext): number {
    const { statName, baseValue } = ctx;
    
    // 명성(경험치) -10%
    if (statName === 'experience') {
      return baseValue * 0.9;
    }
    
    // 사기 +5
    if (statName === 'bonusAtmos') {
      return baseValue + 5;
    }
    
    return baseValue;
  }
}







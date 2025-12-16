/**
 * 왕좌 (王座) - 성격
 * PHP che_왕좌.php 기반
 * 
 * 효과:
 * - 명성(경험치) +10%
 * - 사기 -5
 */

import { PersonalityBase, IStatCalcContext } from './PersonalityBase';

export class Wangjwa extends PersonalityBase {
  readonly id = 0;
  readonly name = '왕좌';
  readonly info = '명성 +10%, 사기 -5';

  override onCalcStat(ctx: IStatCalcContext): number {
    const { statName, baseValue } = ctx;
    
    // 명성(경험치) +10%
    if (statName === 'experience') {
      return baseValue * 1.1;
    }
    
    // 사기 -5
    if (statName === 'bonusAtmos') {
      return baseValue - 5;
    }
    
    return baseValue;
  }
}








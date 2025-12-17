/**
 * 대의 (大義) - 성격
 * PHP che_대의.php 기반
 * 
 * 효과:
 * - 명성(경험치) +10%
 * - 훈련 -5
 */

import { PersonalityBase, IStatCalcContext } from './PersonalityBase';

export class Daeeui extends PersonalityBase {
  readonly id = 1;
  readonly name = '대의';
  readonly info = '명성 +10%, 훈련 -5';

  override onCalcStat(ctx: IStatCalcContext): number {
    const { statName, baseValue } = ctx;
    
    // 명성(경험치) +10%
    if (statName === 'experience') {
      return baseValue * 1.1;
    }
    
    // 훈련 -5
    if (statName === 'bonusTrain') {
      return baseValue - 5;
    }
    
    return baseValue;
  }
}











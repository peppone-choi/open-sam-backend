/**
 * 할거 (割據) - 성격
 * PHP che_할거.php 기반
 * 
 * 효과:
 * - 명성(경험치) -10%
 * - 훈련 +5
 */

import { PersonalityBase, IStatCalcContext } from './PersonalityBase';

export class Halgeo extends PersonalityBase {
  readonly id = 5;
  readonly name = '할거';
  readonly info = '명성 -10%, 훈련 +5';

  override onCalcStat(ctx: IStatCalcContext): number {
    const { statName, baseValue } = ctx;
    
    // 명성(경험치) -10%
    if (statName === 'experience') {
      return baseValue * 0.9;
    }
    
    // 훈련 +5
    if (statName === 'bonusTrain') {
      return baseValue + 5;
    }
    
    return baseValue;
  }
}











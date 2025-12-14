/**
 * 은둔 (隱遁) - 성격
 * PHP che_은둔.php 기반
 * 
 * 효과:
 * - 명성(경험치) -10%
 * - 계급(공헌도) -10%
 * - 사기 -5
 * - 훈련 -5
 * - 단련 성공률 +10%
 */

import { PersonalityBase, IStatCalcContext, IDomesticCalcContext } from './PersonalityBase';

export class Eundun extends PersonalityBase {
  readonly id = 10;
  readonly name = '은둔';
  readonly info = '명성 -10%, 계급 -10%, 사기 -5, 훈련 -5, 단련 성공률 +10%';

  override onCalcDomestic(ctx: IDomesticCalcContext): number {
    const { turnType, varType, baseValue } = ctx;
    
    // 단련 성공률 +10%p
    if (turnType === '단련') {
      if (varType === 'success') {
        return baseValue + 0.1;
      }
    }
    
    return baseValue;
  }

  override onCalcStat(ctx: IStatCalcContext): number {
    const { statName, baseValue } = ctx;
    
    // 사기 -5
    if (statName === 'bonusAtmos') {
      return baseValue - 5;
    }
    
    // 훈련 -5
    if (statName === 'bonusTrain') {
      return baseValue - 5;
    }
    
    // 명성(경험치) -10%
    if (statName === 'experience') {
      return baseValue * 0.9;
    }
    
    // 계급(공헌도) -10%
    if (statName === 'dedication') {
      return baseValue * 0.9;
    }
    
    return baseValue;
  }
}





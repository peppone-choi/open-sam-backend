/**
 * 의협 (義俠) - 성격
 * PHP che_의협.php 기반
 * 
 * 효과:
 * - 사기 +5
 * - 징·모병 비용 +20%
 */

import { PersonalityBase, IStatCalcContext, IDomesticCalcContext } from './PersonalityBase';

export class Uihyeop extends PersonalityBase {
  readonly id = 2;
  readonly name = '의협';
  readonly info = '사기 +5, 징·모병 비용 +20%';

  override onCalcDomestic(ctx: IDomesticCalcContext): number {
    const { turnType, varType, baseValue } = ctx;
    
    // 징·모병 비용 +20%
    if (['징병', '모병'].includes(turnType)) {
      if (varType === 'cost') {
        return baseValue * 1.2;
      }
    }
    
    return baseValue;
  }

  override onCalcStat(ctx: IStatCalcContext): number {
    const { statName, baseValue } = ctx;
    
    // 사기 +5
    if (statName === 'bonusAtmos') {
      return baseValue + 5;
    }
    
    return baseValue;
  }
}











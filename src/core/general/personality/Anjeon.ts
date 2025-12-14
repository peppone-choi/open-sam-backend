/**
 * 안전 (安全) - 성격
 * PHP che_안전.php 기반
 * 
 * 효과:
 * - 사기 -5
 * - 징·모병 비용 -20%
 */

import { PersonalityBase, IStatCalcContext, IDomesticCalcContext } from './PersonalityBase';

export class Anjeon extends PersonalityBase {
  readonly id = 9;
  readonly name = '안전';
  readonly info = '사기 -5, 징·모병 비용 -20%';

  override onCalcDomestic(ctx: IDomesticCalcContext): number {
    const { turnType, varType, baseValue } = ctx;
    
    // 징·모병 비용 -20%
    if (['징병', '모병'].includes(turnType)) {
      if (varType === 'cost') {
        return baseValue * 0.8;
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
    
    return baseValue;
  }
}





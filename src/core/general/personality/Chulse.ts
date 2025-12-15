/**
 * 출세 (出世) - 성격
 * PHP che_출세.php 기반
 * 
 * 효과:
 * - 명성(경험치) +10%
 * - 징·모병 비용 +20%
 */

import { PersonalityBase, IStatCalcContext, IDomesticCalcContext } from './PersonalityBase';

export class Chulse extends PersonalityBase {
  readonly id = 6;
  readonly name = '출세';
  readonly info = '명성 +10%, 징·모병 비용 +20%';

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
    
    // 명성(경험치) +10%
    if (statName === 'experience') {
      return baseValue * 1.1;
    }
    
    return baseValue;
  }
}







/**
 * 유지 (有志) - 성격
 * PHP che_유지.php 기반
 * 
 * 효과:
 * - 훈련 -5
 * - 징·모병 비용 -20%
 */

import { PersonalityBase, IStatCalcContext, IDomesticCalcContext } from './PersonalityBase';

export class Yuji extends PersonalityBase {
  readonly id = 8;
  readonly name = '유지';
  readonly info = '훈련 -5, 징·모병 비용 -20%';

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
    
    // 훈련 -5
    if (statName === 'bonusTrain') {
      return baseValue - 5;
    }
    
    return baseValue;
  }
}









/**
 * 상재 (商才) - 내정 특기
 * PHP che_상재.php 기반
 * 
 * 효과:
 * - [내정] 상업 투자 : 기본 보정 +10%, 성공률 +10%p, 비용 -20%
 */

import {
  PoliticsSpecialityBase,
  IDomesticCalcContext,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

export class Sangjae extends PoliticsSpecialityBase {
  readonly id = 2;
  readonly name = '상재';
  readonly info = '[내정] 상업 투자 : 기본 보정 +10%, 성공률 +10%p, 비용 -20%';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_INTEL];

  /**
   * 내정 계산
   * PHP: 상업 +10%, 성공률 +10%p, 비용 -20%
   */
  override onCalcDomestic(ctx: IDomesticCalcContext): number {
    if (ctx.turnType === '상업') {
      switch (ctx.varType) {
        case 'score':
          return ctx.baseValue * 1.1;
        case 'cost':
          return ctx.baseValue * 0.8;
        case 'success':
          return ctx.baseValue + 0.1;
        default:
          return ctx.baseValue;
      }
    }

    return ctx.baseValue;
  }
}









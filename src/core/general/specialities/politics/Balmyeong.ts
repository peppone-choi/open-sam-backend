/**
 * 발명 (發明) - 내정 특기
 * PHP che_발명.php 기반
 * 
 * 효과:
 * - [내정] 기술 연구 : 기본 보정 +10%, 성공률 +10%p, 비용 -20%
 */

import {
  PoliticsSpecialityBase,
  IDomesticCalcContext,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

export class Balmyeong extends PoliticsSpecialityBase {
  readonly id = 3;
  readonly name = '발명';
  readonly info = '[내정] 기술 연구 : 기본 보정 +10%, 성공률 +10%p, 비용 -20%';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_INTEL];

  /**
   * 내정 계산
   * PHP: 기술 +10%, 성공률 +10%p, 비용 -20%
   */
  override onCalcDomestic(ctx: IDomesticCalcContext): number {
    if (ctx.turnType === '기술') {
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








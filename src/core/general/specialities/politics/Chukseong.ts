/**
 * 축성 (築城) - 내정 특기
 * PHP che_축성.php 기반
 * 
 * 효과:
 * - [내정] 성벽 보수 : 기본 보정 +10%, 성공률 +10%p, 비용 -20%
 */

import {
  PoliticsSpecialityBase,
  IDomesticCalcContext,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

export class Chukseong extends PoliticsSpecialityBase {
  readonly id = 10;
  readonly name = '축성';
  readonly info = '[내정] 성벽 보수 : 기본 보정 +10%, 성공률 +10%p, 비용 -20%';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_STRENGTH];

  /**
   * 내정 계산
   * PHP: 성벽 +10%, 성공률 +10%p, 비용 -20%
   */
  override onCalcDomestic(ctx: IDomesticCalcContext): number {
    if (ctx.turnType === '성벽') {
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







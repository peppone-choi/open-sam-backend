/**
 * 인덕 (仁德) - 내정 특기
 * PHP che_인덕.php 기반
 * 
 * 효과:
 * - [내정] 주민 선정·정착 장려 : 기본 보정 +10%, 성공률 +10%p, 비용 -20%
 */

import {
  PoliticsSpecialityBase,
  IDomesticCalcContext,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

export class Indeok extends PoliticsSpecialityBase {
  readonly id = 20;
  readonly name = '인덕';
  readonly info = '[내정] 주민 선정·정착 장려 : 기본 보정 +10%, 성공률 +10%p, 비용 -20%';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_LEADERSHIP];

  /**
   * 내정 계산
   * PHP: 민심/인구 +10%, 성공률 +10%p, 비용 -20%
   */
  override onCalcDomestic(ctx: IDomesticCalcContext): number {
    if (ctx.turnType === '민심' || ctx.turnType === '인구') {
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








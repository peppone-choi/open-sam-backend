/**
 * 귀모 (鬼謀) - 내정 특기
 * PHP che_귀모.php 기반
 * 
 * 효과:
 * - [계략] 화계·탈취·파괴·선동 : 성공률 +20%p
 */

import {
  PoliticsSpecialityBase,
  IDomesticCalcContext,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

export class Gwimo extends PoliticsSpecialityBase {
  readonly id = 31;
  readonly name = '귀모';
  readonly info = '[계략] 화계·탈취·파괴·선동 : 성공률 +20%p';

  static override selectWeightType = SelectWeightType.PERCENT;
  static override selectWeight = 2.5;
  static override requirements = [
    StatRequirement.STAT_LEADERSHIP,
    StatRequirement.STAT_STRENGTH,
    StatRequirement.STAT_INTEL,
  ];

  /**
   * 내정 계산
   * PHP: 계략 성공률 +20%p
   */
  override onCalcDomestic(ctx: IDomesticCalcContext): number {
    if (ctx.turnType === '계략') {
      if (ctx.varType === 'success') {
        return ctx.baseValue + 0.2;
      }
    }

    return ctx.baseValue;
  }
}







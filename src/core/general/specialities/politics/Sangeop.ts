/**
 * 상업 (商業) - 내정 특기
 * 
 * 효과:
 * - 상업 개발 효과 +30%
 * - 상업 개발 비용 -20%
 * - 세금 수입 +10%
 */

import {
  PoliticsSpecialityBase,
  IDomesticCalcContext,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

export class Sangeop extends PoliticsSpecialityBase {
  readonly id = 11;
  readonly name = '상업';
  readonly info = '[내정] 상업 개발 효과 +30%, 비용 -20%, 세금 수입 +10%';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_INTEL];

  /**
   * 내정 계산
   */
  override onCalcDomestic(ctx: IDomesticCalcContext): number {
    // 상업 관련 명령어
    if (ctx.turnType === '상업' || ctx.turnType === 'commerce') {
      switch (ctx.varType) {
        case 'score':
        case 'effect':
          return ctx.baseValue * 1.3;
        case 'cost':
          return ctx.baseValue * 0.8;
        case 'success':
          return Math.min(1, ctx.baseValue + 0.1);
        default:
          return ctx.baseValue;
      }
    }

    // 세금 수입
    if (ctx.turnType === '세금' || ctx.turnType === 'tax') {
      if (ctx.varType === 'score' || ctx.varType === 'income') {
        return ctx.baseValue * 1.1;
      }
    }

    return ctx.baseValue;
  }

  /**
   * 내정 효율 보정
   */
  override getDomesticEfficiency(type: string): number {
    if (type === '상업' || type === 'commerce') {
      return 1.3;
    }
    return 1;
  }

  /**
   * 비용 감소율
   */
  override getCostReduction(type: string): number {
    if (type === '상업' || type === 'commerce') {
      return 0.2;
    }
    return 0;
  }
}



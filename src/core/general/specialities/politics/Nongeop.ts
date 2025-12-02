/**
 * 농업 (農業) - 내정 특기
 * 
 * 효과:
 * - 농업 개발 효과 +30%
 * - 농업 개발 비용 -20%
 * - 식량 생산량 +10%
 */

import {
  PoliticsSpecialityBase,
  IDomesticCalcContext,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

export class Nongeop extends PoliticsSpecialityBase {
  readonly id = 10;
  readonly name = '농업';
  readonly info = '[내정] 농업 개발 효과 +30%, 비용 -20%, 식량 생산량 +10%';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_LEADERSHIP];

  /**
   * 내정 계산
   */
  override onCalcDomestic(ctx: IDomesticCalcContext): number {
    // 농업 관련 명령어
    if (ctx.turnType === '농업' || ctx.turnType === 'agriculture') {
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

    // 식량 생산
    if (ctx.turnType === '식량생산' || ctx.turnType === 'food_production') {
      if (ctx.varType === 'score' || ctx.varType === 'production') {
        return ctx.baseValue * 1.1;
      }
    }

    return ctx.baseValue;
  }

  /**
   * 내정 효율 보정
   */
  override getDomesticEfficiency(type: string): number {
    if (type === '농업' || type === 'agriculture') {
      return 1.3;
    }
    return 1;
  }

  /**
   * 비용 감소율
   */
  override getCostReduction(type: string): number {
    if (type === '농업' || type === 'agriculture') {
      return 0.2;
    }
    return 0;
  }
}



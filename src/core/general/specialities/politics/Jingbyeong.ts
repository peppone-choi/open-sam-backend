/**
 * 징병 (徵兵) - 내정 특기
 * PHP che_징병.php 기반
 * 
 * 효과:
 * - 징병 효율 +30%
 * - 징병 비용 -20%
 * - 징병 시 민심 감소 -50%
 */

import {
  PoliticsSpecialityBase,
  IDomesticCalcContext,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

export class Jingbyeong extends PoliticsSpecialityBase {
  readonly id = 13;
  readonly name = '징병';
  readonly info = '[내정] 징병 효율 +30%, 비용 -20%, 민심 감소 -50%';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_LEADERSHIP];

  /**
   * 내정 계산
   */
  override onCalcDomestic(ctx: IDomesticCalcContext): number {
    // 징병 관련 명령어
    if (ctx.turnType === '징병' || ctx.turnType === 'draft') {
      switch (ctx.varType) {
        case 'score':
        case 'effect':
        case 'troops':
          return ctx.baseValue * 1.3;
        case 'cost':
          return ctx.baseValue * 0.8;
        case 'moraleLoss':
        case 'popularity_loss':
          return ctx.baseValue * 0.5; // 민심 감소 절반
        case 'success':
          return Math.min(1, ctx.baseValue + 0.1);
        default:
          return ctx.baseValue;
      }
    }

    return ctx.baseValue;
  }

  /**
   * 내정 효율 보정
   */
  override getDomesticEfficiency(type: string): number {
    if (type === '징병' || type === 'draft') {
      return 1.3;
    }
    return 1;
  }

  /**
   * 비용 감소율
   */
  override getCostReduction(type: string): number {
    if (type === '징병' || type === 'draft') {
      return 0.2;
    }
    return 0;
  }
}



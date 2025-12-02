/**
 * 훈련 (訓練) - 내정 특기
 * 
 * 효과:
 * - 훈련 효과 +35%
 * - 훈련 비용 -20%
 * - 병사 숙련도 증가 +15%
 */

import {
  PoliticsSpecialityBase,
  IDomesticCalcContext,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

export class Hullyeon extends PoliticsSpecialityBase {
  readonly id = 14;
  readonly name = '훈련';
  readonly info = '[내정] 훈련 효과 +35%, 비용 -20%, 숙련도 증가 +15%';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_STRENGTH];

  /**
   * 내정 계산
   */
  override onCalcDomestic(ctx: IDomesticCalcContext): number {
    // 훈련 관련 명령어
    if (ctx.turnType === '훈련' || ctx.turnType === 'training') {
      switch (ctx.varType) {
        case 'score':
        case 'effect':
          return ctx.baseValue * 1.35;
        case 'cost':
          return ctx.baseValue * 0.8;
        case 'dexterity':
        case 'skill':
        case 'proficiency':
          return ctx.baseValue * 1.15;
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
    if (type === '훈련' || type === 'training') {
      return 1.35;
    }
    return 1;
  }

  /**
   * 비용 감소율
   */
  override getCostReduction(type: string): number {
    if (type === '훈련' || type === 'training') {
      return 0.2;
    }
    return 0;
  }
}



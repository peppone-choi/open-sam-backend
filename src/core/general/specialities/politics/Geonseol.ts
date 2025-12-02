/**
 * 건설 (建設) - 내정 특기
 * 
 * 효과:
 * - 건설 속도 +40%
 * - 건설 비용 -25%
 * - 성벽 내구도 +15%
 */

import {
  PoliticsSpecialityBase,
  IDomesticCalcContext,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

export class Geonseol extends PoliticsSpecialityBase {
  readonly id = 12;
  readonly name = '건설';
  readonly info = '[내정] 건설 속도 +40%, 비용 -25%, 성벽 내구도 +15%';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_LEADERSHIP];

  /**
   * 내정 계산
   */
  override onCalcDomestic(ctx: IDomesticCalcContext): number {
    // 건설/축성 관련 명령어
    if (
      ctx.turnType === '건설' ||
      ctx.turnType === '축성' ||
      ctx.turnType === 'construction' ||
      ctx.turnType === 'wall'
    ) {
      switch (ctx.varType) {
        case 'score':
        case 'effect':
        case 'speed':
          return ctx.baseValue * 1.4;
        case 'cost':
          return ctx.baseValue * 0.75;
        case 'success':
          return Math.min(1, ctx.baseValue + 0.15);
        default:
          return ctx.baseValue;
      }
    }

    // 성벽 내구도
    if (ctx.turnType === '성벽' || ctx.turnType === 'fortress') {
      if (ctx.varType === 'durability' || ctx.varType === 'hp') {
        return ctx.baseValue * 1.15;
      }
    }

    return ctx.baseValue;
  }

  /**
   * 내정 효율 보정
   */
  override getDomesticEfficiency(type: string): number {
    if (
      type === '건설' ||
      type === '축성' ||
      type === 'construction' ||
      type === 'wall'
    ) {
      return 1.4;
    }
    return 1;
  }

  /**
   * 비용 감소율
   */
  override getCostReduction(type: string): number {
    if (
      type === '건설' ||
      type === '축성' ||
      type === 'construction' ||
      type === 'wall'
    ) {
      return 0.25;
    }
    return 0;
  }
}



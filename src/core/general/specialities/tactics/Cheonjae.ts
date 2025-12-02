/**
 * 천재 (天才) - 계략 특기
 * 
 * 효과:
 * - 계략 성공률 대폭 증가 (+30%)
 * - 모든 계략 데미지 +20%
 * - 반계 저항 +15%
 */

import {
  TacticsSpecialityBase,
  IStatCalcContext,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

export class Cheonjae extends TacticsSpecialityBase {
  readonly id = 40;
  readonly name = '천재';
  readonly info =
    '[계략] 계략 성공률 +30%, 모든 계략 데미지 +20%, 반계 저항 +15%';

  static override selectWeightType = SelectWeightType.PERCENT;
  static override selectWeight = 3;
  static override requirements = [StatRequirement.STAT_INTEL];

  /**
   * 스탯 계산
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    switch (ctx.statName) {
      case 'warMagicSuccessProb':
      case 'tacticsSuccessRate':
        return ctx.baseValue + 0.3;
      case 'warMagicSuccessDamage':
      case 'tacticsDamage':
        return ctx.baseValue * 1.2;
      case 'counterTacticsResistance':
        return ctx.baseValue + 0.15;
      default:
        return ctx.baseValue;
    }
  }

  /**
   * 계략 성공 확률 보정
   */
  override getTacticsSuccessBonus(baseRate: number): number {
    return baseRate + 0.3;
  }

  /**
   * 계략 데미지 배수
   */
  override getTacticsDamageMultiplier(): number {
    return 1.2;
  }
}



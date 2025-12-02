/**
 * 질풍 (疾風) - 전투 특기
 * 
 * 효과:
 * - 이동 속도 +2
 * - 선제 공격 확률 +20%
 * - 퇴각 성공률 +30%
 */

import {
  BattleSpecialityBase,
  IStatCalcContext,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

export class Jilpung extends BattleSpecialityBase {
  readonly id = 48;
  readonly name = '질풍';
  readonly info = '[전투] 이동 속도 +2, 선제 공격 확률 +20%, 퇴각 성공률 +30%';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [
    StatRequirement.STAT_STRENGTH,
    StatRequirement.STAT_LEADERSHIP,
  ];

  /**
   * 스탯 계산
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    switch (ctx.statName) {
      case 'speed':
      case 'moveSpeed':
      case 'mobility':
        return ctx.baseValue + 2;
      case 'initiativeRate':
      case 'preemptiveRate':
        return ctx.baseValue + 0.2;
      case 'retreatSuccessRate':
        return ctx.baseValue + 0.3;
      default:
        return ctx.baseValue;
    }
  }

  /**
   * 선제 공격 확률 보정
   */
  override getInitiativeBonus(baseValue: number): number {
    return baseValue + 0.2; // +20%
  }
}



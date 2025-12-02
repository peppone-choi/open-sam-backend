/**
 * 귀모 (鬼謀) - 계략 특기
 * PHP che_귀모.php 기반
 * 
 * 효과:
 * - 화계·탈취·파괴·선동 : 성공률 +20%p
 * - 반계 성공률 +15%
 */

import {
  TacticsSpecialityBase,
  IStatCalcContext,
  IDomesticCalcContext,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

export class Gwimo extends TacticsSpecialityBase {
  readonly id = 31;
  readonly name = '귀모';
  readonly info = '[계략] 화계·탈취·파괴·선동 성공률 +20%p, 반계 성공률 +15%';

  static override selectWeightType = SelectWeightType.PERCENT;
  static override selectWeight = 2.5;
  static override requirements = [
    StatRequirement.STAT_LEADERSHIP,
    StatRequirement.STAT_STRENGTH,
    StatRequirement.STAT_INTEL,
  ];

  /**
   * 대상 계략 목록
   */
  private targetTactics = ['화계', '탈취', '파괴', '선동', 'fire', 'steal', 'destroy', 'incite'];

  /**
   * 스탯 계산
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    // 특정 계략의 성공률 보정
    if (ctx.statName === 'tacticsSuccessRate' && ctx.skillId) {
      if (this.isTargetTactics(ctx.skillId)) {
        return ctx.baseValue + 0.2;
      }
    }
    return ctx.baseValue;
  }

  /**
   * 내정 계산 (계략 성공률)
   */
  override onCalcDomestic(ctx: IDomesticCalcContext): number {
    if (ctx.turnType === '계략' && ctx.varType === 'success') {
      return ctx.baseValue + 0.2;
    }
    return ctx.baseValue;
  }

  /**
   * 반계 확률
   */
  override getCounterTacticsChance(): number {
    return 0.15;
  }

  /**
   * 대상 계략인지 확인
   */
  private isTargetTactics(skillId: string): boolean {
    return this.targetTactics.some(
      (t) => skillId.toLowerCase().includes(t.toLowerCase())
    );
  }
}



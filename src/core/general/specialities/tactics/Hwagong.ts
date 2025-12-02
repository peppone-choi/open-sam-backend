/**
 * 화공 (火攻) - 계략 특기
 * 
 * 효과:
 * - 화공 계략 효과 +40%
 * - 화공 성공률 +25%
 * - 불 지속 시간 증가
 */

import {
  TacticsSpecialityBase,
  IStatCalcContext,
  IBattleContext,
  ITriggerResult,
  TriggerTiming,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

export class Hwagong extends TacticsSpecialityBase {
  readonly id = 41;
  readonly name = '화공';
  readonly info = '[계략] 화공 계략 효과 +40%, 성공률 +25%, 화염 지속 시간 증가';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_INTEL];

  /**
   * 화공 관련 스킬 목록
   */
  private fireSkills = ['화공', '화계', 'fire', '방화', '연화'];

  /**
   * 스탯 계산
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    if (ctx.skillId && this.isFireSkill(ctx.skillId)) {
      switch (ctx.statName) {
        case 'warMagicSuccessProb':
        case 'tacticsSuccessRate':
          return ctx.baseValue + 0.25;
        case 'warMagicSuccessDamage':
        case 'tacticsDamage':
          return ctx.baseValue * 1.4;
        case 'effectDuration':
        case 'burnDuration':
          return ctx.baseValue + 2; // +2턴
        default:
          return ctx.baseValue;
      }
    }
    return ctx.baseValue;
  }

  /**
   * 계략 성공 확률 보정 (화공 한정)
   */
  override getTacticsSuccessBonus(baseRate: number): number {
    return baseRate + 0.15; // 기본 보너스
  }

  /**
   * 계략 데미지 배수 (화공 한정)
   */
  override getTacticsDamageMultiplier(): number {
    return 1.4;
  }

  /**
   * 트리거 지원
   */
  override supportsTrigger(timing: TriggerTiming): boolean {
    return timing === TriggerTiming.ON_SKILL;
  }

  override getSupportedTriggers(): TriggerTiming[] {
    return [TriggerTiming.ON_SKILL];
  }

  /**
   * 스킬 사용 시 트리거
   */
  override onTrigger(
    timing: TriggerTiming,
    _ctx: IBattleContext
  ): ITriggerResult {
    if (timing === TriggerTiming.ON_SKILL) {
      return {
        activated: true,
        message: '화공 특기 발동! 화염 효과가 강화됩니다!',
        effects: {
          fireDamageBonus: 0.4,
          burnDurationBonus: 2,
        },
      };
    }
    return { activated: false };
  }

  /**
   * 화공 스킬인지 확인
   */
  private isFireSkill(skillId: string): boolean {
    return this.fireSkills.some((s) =>
      skillId.toLowerCase().includes(s.toLowerCase())
    );
  }
}



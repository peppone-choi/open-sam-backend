/**
 * 독살 (毒殺) - 계략 특기
 * 
 * 효과:
 * - 독 계략 효과 +50%
 * - 독 성공률 +20%
 * - 독 지속 데미지 증가
 * - 해독 난이도 상승
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

export class Doksal extends TacticsSpecialityBase {
  readonly id = 44;
  readonly name = '독살';
  readonly info =
    '[계략] 독 계략 효과 +50%, 성공률 +20%, 지속 데미지 증가, 해독 난이도 상승';

  static override selectWeightType = SelectWeightType.PERCENT;
  static override selectWeight = 2;
  static override requirements = [StatRequirement.STAT_INTEL];

  /**
   * 독 관련 스킬 목록
   */
  private poisonSkills = ['독', 'poison', '독살', '맹독', '독화살'];

  /**
   * 스탯 계산
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    if (ctx.skillId && this.isPoisonSkill(ctx.skillId)) {
      switch (ctx.statName) {
        case 'warMagicSuccessProb':
        case 'tacticsSuccessRate':
          return ctx.baseValue + 0.2;
        case 'warMagicSuccessDamage':
        case 'tacticsDamage':
          return ctx.baseValue * 1.5;
        case 'poisonDuration':
        case 'effectDuration':
          return ctx.baseValue + 3; // +3턴
        case 'dotDamage':
        case 'poisonDamagePerTurn':
          return ctx.baseValue * 1.3;
        default:
          return ctx.baseValue;
      }
    }

    // 해독 난이도 상승 (적에게 적용)
    if (ctx.statName === 'curePoisionDifficulty') {
      return ctx.baseValue + 0.3;
    }

    return ctx.baseValue;
  }

  /**
   * 상대 스탯 계산 (해독 성공률 감소)
   */
  override onCalcOpposeStat(ctx: IStatCalcContext): number {
    if (ctx.statName === 'cureSuccessRate') {
      return ctx.baseValue - 0.2;
    }
    return ctx.baseValue;
  }

  /**
   * 계략 성공 확률 보정
   */
  override getTacticsSuccessBonus(baseRate: number): number {
    return baseRate + 0.2;
  }

  /**
   * 계략 데미지 배수
   */
  override getTacticsDamageMultiplier(): number {
    return 1.5;
  }

  /**
   * 트리거 지원
   */
  override supportsTrigger(timing: TriggerTiming): boolean {
    return timing === TriggerTiming.ON_SKILL || timing === TriggerTiming.TURN_END;
  }

  override getSupportedTriggers(): TriggerTiming[] {
    return [TriggerTiming.ON_SKILL, TriggerTiming.TURN_END];
  }

  /**
   * 트리거 처리
   */
  override onTrigger(
    timing: TriggerTiming,
    _ctx: IBattleContext
  ): ITriggerResult {
    if (timing === TriggerTiming.ON_SKILL) {
      return {
        activated: true,
        message: '독살 특기 발동! 독 효과가 강화됩니다!',
        effects: {
          poisonDamageBonus: 0.5,
          poisonDurationBonus: 3,
        },
      };
    }

    if (timing === TriggerTiming.TURN_END) {
      // 독 지속 데미지 적용
      return {
        activated: true,
        message: '독이 퍼집니다...',
        effects: {
          applyPoisonDot: 1,
        },
      };
    }

    return { activated: false };
  }

  /**
   * 독 스킬인지 확인
   */
  private isPoisonSkill(skillId: string): boolean {
    return this.poisonSkills.some((s) =>
      skillId.toLowerCase().includes(s.toLowerCase())
    );
  }
}



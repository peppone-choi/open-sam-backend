/**
 * 기습 (奇襲) - 전투 특기
 * 
 * 효과:
 * - 기습 공격 성공률 +25%
 * - 기습 성공 시 첫 공격 데미지 +50%
 * - 야간 전투 시 추가 보너스
 */

import {
  BattleSpecialityBase,
  IStatCalcContext,
  IWarPowerMultiplier,
  IBattleContext,
  ITriggerResult,
  TriggerTiming,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';
import { BattleUnit } from '../../../battle/interfaces/Unit';

export class Giseup extends BattleSpecialityBase {
  readonly id = 49;
  readonly name = '기습';
  readonly info =
    '[전투] 기습 성공률 +25%, 기습 성공 시 첫 공격 데미지 +50%';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [
    StatRequirement.STAT_INTEL,
    StatRequirement.STAT_STRENGTH,
  ];

  private isAmbushSuccessful = false;

  /**
   * 스탯 계산
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    switch (ctx.statName) {
      case 'ambushSuccessRate':
      case 'surpriseAttackRate':
        return ctx.baseValue + 0.25;
      case 'nightBattleBonus':
        return ctx.baseValue + 0.1;
      default:
        return ctx.baseValue;
    }
  }

  /**
   * 전투력 배수 계산
   */
  override getWarPowerMultiplier(
    _unit: BattleUnit,
    _opponent?: BattleUnit
  ): IWarPowerMultiplier {
    // 기습 성공 시 첫 공격 데미지 보너스
    if (this.isAmbushSuccessful) {
      return {
        attackMultiplier: 1.5,
        defenseMultiplier: 1,
      };
    }

    return {
      attackMultiplier: 1,
      defenseMultiplier: 1,
    };
  }

  /**
   * 트리거 지원
   */
  override supportsTrigger(timing: TriggerTiming): boolean {
    return (
      timing === TriggerTiming.BATTLE_START ||
      timing === TriggerTiming.BEFORE_ATTACK
    );
  }

  override getSupportedTriggers(): TriggerTiming[] {
    return [TriggerTiming.BATTLE_START, TriggerTiming.BEFORE_ATTACK];
  }

  /**
   * 트리거 처리
   */
  override onTrigger(
    timing: TriggerTiming,
    ctx: IBattleContext
  ): ITriggerResult {
    if (timing === TriggerTiming.BATTLE_START) {
      // 기습 성공 판정 (기본 30% + 보너스 25% = 55%)
      const baseRate = 0.3;
      const successRate = baseRate + 0.25;

      if (Math.random() < successRate) {
        this.isAmbushSuccessful = true;
        return {
          activated: true,
          message: '기습 성공! 첫 공격 데미지가 증가합니다!',
          effects: { ambushSuccess: 1, firstAttackBonus: 0.5 },
        };
      }
    }

    if (timing === TriggerTiming.BEFORE_ATTACK && ctx.currentTurn === 1) {
      if (this.isAmbushSuccessful) {
        // 첫 공격 후 기습 효과 해제
        this.isAmbushSuccessful = false;
        return {
          activated: true,
          message: '기습 공격!',
          effects: { damageMultiplier: 1.5 },
        };
      }
    }

    return { activated: false };
  }
}



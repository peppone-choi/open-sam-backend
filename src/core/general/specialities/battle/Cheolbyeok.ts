/**
 * 철벽 (鐵壁) - 전투 특기
 * 
 * 효과:
 * - 받는 데미지 -15%
 * - 방어 시 추가 데미지 감소 -10%
 * - 방어 성공 시 반격 확률 +20%
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

export class Cheolbyeok extends BattleSpecialityBase {
  readonly id = 46;
  readonly name = '철벽';
  readonly info =
    '[전투] 받는 데미지 -15%, 방어 시 추가 감소 -10%, 반격 확률 +20%';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [
    StatRequirement.STAT_LEADERSHIP,
    StatRequirement.STAT_STRENGTH,
  ];

  /**
   * 스탯 계산 - 반격 확률 보정
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    if (ctx.statName === 'counterAttackRate') {
      return ctx.baseValue + 0.2; // +20%
    }
    return ctx.baseValue;
  }

  /**
   * 전투력 배수 계산
   */
  override getWarPowerMultiplier(
    _unit: BattleUnit,
    _opponent?: BattleUnit
  ): IWarPowerMultiplier {
    return {
      attackMultiplier: 1,
      defenseMultiplier: 0.85, // 받는 데미지 -15%
    };
  }

  /**
   * 트리거 지원
   */
  override supportsTrigger(timing: TriggerTiming): boolean {
    return (
      timing === TriggerTiming.ON_DEFEND ||
      timing === TriggerTiming.AFTER_DEFEND
    );
  }

  override getSupportedTriggers(): TriggerTiming[] {
    return [TriggerTiming.ON_DEFEND, TriggerTiming.AFTER_DEFEND];
  }

  /**
   * 방어 시 트리거
   */
  override onTrigger(
    timing: TriggerTiming,
    _ctx: IBattleContext
  ): ITriggerResult {
    if (timing === TriggerTiming.ON_DEFEND) {
      return {
        activated: true,
        message: '철벽 방어! 추가 데미지 감소!',
        effects: { extraDefenseReduction: 0.1 },
      };
    }

    if (timing === TriggerTiming.AFTER_DEFEND) {
      // 반격 확률 판정
      if (Math.random() < 0.2) {
        return {
          activated: true,
          message: '철벽 반격!',
          effects: { counterAttack: 1 },
        };
      }
    }

    return { activated: false };
  }
}



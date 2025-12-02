/**
 * 인덕 (仁德) - 전투 특기
 * 
 * 효과:
 * - 아군 사기 보너스 +10
 * - 전투 시작 시 아군 전체 사기 +5
 */

import {
  BattleSpecialityBase,
  IStatCalcContext,
  IBattleContext,
  ITriggerResult,
  TriggerTiming,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

export class Indeok extends BattleSpecialityBase {
  readonly id = 20;
  readonly name = '인덕';
  readonly info = '[전투] 아군 사기 보너스 +10, 전투 시작 시 아군 전체 사기 +5';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_LEADERSHIP];

  /**
   * 스탯 계산 - 사기 보정
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    if (ctx.statName === 'morale' || ctx.statName === 'initialMorale') {
      return ctx.baseValue + 10;
    }
    return ctx.baseValue;
  }

  /**
   * 전투 시작 시 사기 보정
   */
  override getInitialMoraleBonus(): number {
    return 5;
  }

  /**
   * 트리거 지원
   */
  override supportsTrigger(timing: TriggerTiming): boolean {
    return timing === TriggerTiming.BATTLE_START;
  }

  override getSupportedTriggers(): TriggerTiming[] {
    return [TriggerTiming.BATTLE_START];
  }

  /**
   * 전투 시작 시 트리거
   */
  override onTrigger(
    timing: TriggerTiming,
    _ctx: IBattleContext
  ): ITriggerResult {
    if (timing === TriggerTiming.BATTLE_START) {
      return {
        activated: true,
        message: '인덕의 효과로 아군의 사기가 상승합니다!',
        effects: { allyMoraleBonus: 5 },
      };
    }
    return { activated: false };
  }
}



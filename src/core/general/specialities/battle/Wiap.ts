/**
 * 위압 (威壓) - 전투 특기
 * PHP che_위압.php 기반
 * 
 * 효과:
 * - [전투] 첫 페이즈 위압 발동 (적 공격, 회피 불가, 사기 5 감소)
 */

import {
  BattleSpecialityBase,
  StatRequirement,
  SelectWeightType,
  TriggerTiming,
  IBattleContext,
  ITriggerResult,
} from '../SpecialityBase';

export class Wiap extends BattleSpecialityBase {
  readonly id = 63;
  readonly name = '위압';
  readonly info = '[전투] 첫 페이즈 위압 발동(적 공격, 회피 불가, 사기 5 감소)';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_STRENGTH];

  /**
   * 지원하는 트리거 타이밍
   */
  override getSupportedTriggers(): TriggerTiming[] {
    return [TriggerTiming.BATTLE_START, TriggerTiming.TURN_START];
  }

  /**
   * 트리거 지원 여부
   */
  override supportsTrigger(timing: TriggerTiming): boolean {
    return timing === TriggerTiming.BATTLE_START || timing === TriggerTiming.TURN_START;
  }

  /**
   * 첫 페이즈 위압 발동
   */
  override onTrigger(timing: TriggerTiming, ctx: IBattleContext): ITriggerResult {
    // 첫 페이즈(턴 0)에서만 발동
    if (ctx.currentTurn !== 0) {
      return { activated: false };
    }

    if (timing === TriggerTiming.BATTLE_START || timing === TriggerTiming.TURN_START) {
      return {
        activated: true,
        message: '<C>위압</>이 발동했다!',
        effects: {
          opposeAtmosReduction: 5,    // 적 사기 -5
          opposeCannotAttack: 1,      // 적 공격 불가
          opposeCannotEvade: 1,       // 적 회피 불가
        },
      };
    }

    return { activated: false };
  }
}











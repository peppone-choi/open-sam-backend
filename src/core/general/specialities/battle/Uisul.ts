/**
 * 의술 (醫術) - 전투 특기
 * PHP che_의술.php 기반
 * 
 * 효과:
 * - [군사] 매 턴마다 자신(100%)과 소속 도시 장수(적 포함 50%) 부상 회복
 * - [전투] 페이즈마다 40% 확률로 치료 발동 (아군 피해 30% 감소, 부상 회복)
 */

import {
  BattleSpecialityBase,
  IWarPowerMultiplier,
  StatRequirement,
  SelectWeightType,
  TriggerTiming,
  IBattleContext,
  ITriggerResult,
} from '../SpecialityBase';
import { BattleUnit } from '../../../battle/interfaces/Unit';

export class Uisul extends BattleSpecialityBase {
  readonly id = 73;
  readonly name = '의술';
  readonly info =
    '[군사] 매 턴마다 자신(100%)과 소속 도시 장수(적 포함 50%) 부상 회복<br>[전투] 페이즈마다 40% 확률로 치료 발동(아군 피해 30% 감소, 부상 회복)';

  static override selectWeightType = SelectWeightType.PERCENT;
  static override selectWeight = 2;
  static override requirements = [
    StatRequirement.STAT_LEADERSHIP,
    StatRequirement.STAT_STRENGTH,
    StatRequirement.STAT_INTEL,
  ];

  /**
   * 지원하는 트리거 타이밍
   */
  override getSupportedTriggers(): TriggerTiming[] {
    return [TriggerTiming.BEFORE_DEFEND, TriggerTiming.TURN_END];
  }

  /**
   * 트리거 지원 여부
   */
  override supportsTrigger(timing: TriggerTiming): boolean {
    return timing === TriggerTiming.BEFORE_DEFEND || timing === TriggerTiming.TURN_END;
  }

  /**
   * 전투 중 치료 발동 (40% 확률)
   */
  override onTrigger(timing: TriggerTiming, ctx: IBattleContext): ITriggerResult {
    if (timing === TriggerTiming.BEFORE_DEFEND) {
      // 40% 확률로 치료 발동
      if (Math.random() < 0.4) {
        return {
          activated: true,
          message: '<C>치료</>가 발동했다!',
          effects: {
            damageReduction: 0.3,  // 아군 피해 30% 감소
            injuryHeal: 1,         // 부상 회복 플래그
          },
        };
      }
    }

    return { activated: false };
  }

  /**
   * 전투력 배수 - 치료 발동 시 방어 보너스
   */
  override getWarPowerMultiplier(
    unit: BattleUnit,
    _opponent?: BattleUnit
  ): IWarPowerMultiplier {
    // 기본 상태에서는 보너스 없음
    // 치료 발동 시 트리거에서 처리
    return {
      attackMultiplier: 1,
      defenseMultiplier: 1,
    };
  }
}











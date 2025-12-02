/**
 * 옥란백용구 (등급 12)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_12_옥란백용구.php
 * 특수 효과: 남은 병력이 적을수록 회피 확률 증가. 최대 +50%p
 */

import { SpecialMount } from '../MountBase';
import { MountSpecialEffects, MountStatCalculators, EffectDescriptions } from '../MountEffects';
import { General, StatType } from '../types';

/**
 * 옥란백용구 - 전설적인 흰 용마
 * 통솔 +12, 남은 병력이 적을수록 회피 확률 증가. 최대 +50%p
 */
export class Mount12OkranBaekYongGu extends SpecialMount {
  readonly code = 'che_명마_12_옥란백용구';
  readonly rawName = '옥란백용구';
  readonly statValue = 12;
  readonly specialEffectId = MountSpecialEffects.LOW_HP_EVASION;
  readonly specialEffectDescription = EffectDescriptions[MountSpecialEffects.LOW_HP_EVASION];

  protected _cost = 200;
  protected _buyable = false;

  onCalcStat(general: General, statName: StatType, value: number, aux?: unknown): number {
    // 기본 통솔 보너스
    value = super.onCalcStat(general, statName, value, aux);
    // 병력 비례 회피 보너스
    return MountStatCalculators.lowHpEvasionBonus(general, statName, value, 0.5);
  }
}



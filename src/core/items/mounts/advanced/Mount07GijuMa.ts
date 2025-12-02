/**
 * 기주마 (등급 7)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_07_기주마.php
 * 특수 효과: 공격 시 페이즈 +1
 */

import { SpecialMount } from '../MountBase';
import { MountSpecialEffects, MountStatCalculators, EffectDescriptions } from '../MountEffects';
import { General, StatType } from '../types';

/**
 * 기주마 - 기주 지역의 준마
 * 통솔 +7, 공격 시 페이즈 +1
 */
export class Mount07GijuMa extends SpecialMount {
  readonly code = 'che_명마_07_기주마';
  readonly rawName = '기주마';
  readonly statValue = 7;
  readonly specialEffectId = MountSpecialEffects.PHASE_PLUS_ONE;
  readonly specialEffectDescription = EffectDescriptions[MountSpecialEffects.PHASE_PLUS_ONE];

  protected _cost = 200;
  protected _buyable = false;

  onCalcStat(general: General, statName: StatType, value: number, aux?: unknown): number {
    // 기본 통솔 보너스
    value = super.onCalcStat(general, statName, value, aux);
    // 페이즈 +1
    return MountStatCalculators.phasePlusOne(statName, value);
  }
}



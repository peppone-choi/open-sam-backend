/**
 * 백상 (등급 7) - 코끼리
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_07_백상.php
 * 특수 효과: 공격력 +20%, 소모 군량 +10%, 공격 시 페이즈 -1
 */

import { SpecialMount } from '../MountBase';
import { MountSpecialEffects, MountStatCalculators, MountWarPowerMultipliers, EffectDescriptions } from '../MountEffects';
import { General, StatType, WarUnit } from '../types';

/**
 * 백상 - 흰 코끼리
 * 통솔 +7, 공격력 +20%, 소모 군량 +10%, 공격 시 페이즈 -1
 */
export class Mount07BaekSang extends SpecialMount {
  readonly code = 'che_명마_07_백상';
  readonly rawName = '백상';
  readonly statValue = 7;
  readonly specialEffectId = MountSpecialEffects.ELEPHANT_CHARGE;
  readonly specialEffectDescription = EffectDescriptions[MountSpecialEffects.ELEPHANT_CHARGE];

  protected _cost = 200;
  protected _buyable = false;

  onCalcStat(general: General, statName: StatType, value: number, aux?: unknown): number {
    // 기본 통솔 보너스
    value = super.onCalcStat(general, statName, value, aux);
    // 페이즈 -1
    value = MountStatCalculators.phaseMinusOne(statName, value);
    // 군량 소모 +10%
    value = MountStatCalculators.killRiceMultiplier(statName, value, 1.1);
    return value;
  }

  getWarPowerMultiplier(unit: WarUnit): [number, number] {
    // 공격력 +20%
    return MountWarPowerMultipliers.elephantPower();
  }
}



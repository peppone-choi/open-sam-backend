/**
 * 사륜거 (등급 12) - 전차
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_12_사륜거.php
 * 특수 효과: 전투 종료로 인한 부상 없음
 */

import { SpecialMount } from '../MountBase';
import { MountSpecialEffects, NoRetreatInjuryTrigger, EffectDescriptions } from '../MountEffects';
import { WarUnit, WarUnitTriggerCaller } from '../types';

/**
 * 사륜거 - 4바퀴 전차
 * 통솔 +12, 전투 종료로 인한 부상 없음
 */
export class Mount12SaryunGeo extends SpecialMount {
  readonly code = 'che_명마_12_사륜거';
  readonly rawName = '사륜거';
  readonly statValue = 12;
  readonly specialEffectId = MountSpecialEffects.NO_RETREAT_INJURY;
  readonly specialEffectDescription = EffectDescriptions[MountSpecialEffects.NO_RETREAT_INJURY];

  protected _cost = 200;
  protected _buyable = false;

  getBattleInitSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null {
    return new WarUnitTriggerCaller(
      new NoRetreatInjuryTrigger(unit)
    );
  }
}



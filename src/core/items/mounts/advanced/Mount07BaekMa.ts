/**
 * 백마 (등급 7)
 * PHP 참조: core/hwe/sammo/ActionItem/che_명마_07_백마.php
 * 특수 효과: 전투 종료로 인한 부상 없음
 */

import { SpecialMount } from '../MountBase';
import { MountSpecialEffects, NoRetreatInjuryTrigger, EffectDescriptions } from '../MountEffects';
import { WarUnit, WarUnitTriggerCaller } from '../types';

/**
 * 백마 - 흰색의 신성한 준마
 * 통솔 +7, 전투 종료로 인한 부상 없음
 */
export class Mount07BaekMa extends SpecialMount {
  readonly code = 'che_명마_07_백마';
  readonly rawName = '백마';
  readonly statValue = 7;
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



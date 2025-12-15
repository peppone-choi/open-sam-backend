/**
 * 저격 (狙擊) - 전투 특기
 * PHP che_저격.php 기반
 * 
 * 효과:
 * - [전투] 새로운 상대와 전투 시 50% 확률로 저격 발동
 * - [전투] 성공 시 사기 +20
 */

import {
  BattleSpecialityBase,
  StatRequirement,
  SelectWeightType,
  TriggerTiming,
  IBattleContext,
  ITriggerResult,
} from '../SpecialityBase';

export class Jeogyeok extends BattleSpecialityBase {
  readonly id = 70;
  readonly name = '저격';
  readonly info = '[전투] 새로운 상대와 전투 시 50% 확률로 저격 발동, 성공 시 사기+20';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [
    StatRequirement.STAT_LEADERSHIP,
    StatRequirement.STAT_STRENGTH,
    StatRequirement.STAT_INTEL,
  ];

  /**
   * 지원하는 트리거 타이밍
   */
  override getSupportedTriggers(): TriggerTiming[] {
    return [TriggerTiming.BATTLE_START];
  }

  /**
   * 트리거 지원 여부
   */
  override supportsTrigger(timing: TriggerTiming): boolean {
    return timing === TriggerTiming.BATTLE_START;
  }

  /**
   * 저격 발동 (새 상대 50%, 사기+20)
   */
  override onTrigger(timing: TriggerTiming, ctx: IBattleContext): ITriggerResult {
    if (timing === TriggerTiming.BATTLE_START) {
      // PHP: 50% 확률로 저격 발동
      if (Math.random() < 0.5) {
        return {
          activated: true,
          message: '<C>저격</>이 성공했다!',
          effects: {
            atmosBonus: 20,           // 사기 +20
            sniperActivated: 1,       // 저격 발동 플래그
          },
        };
      } else {
        return {
          activated: false,
          message: '저격이 빗나갔다!',
        };
      }
    }

    return { activated: false };
  }
}







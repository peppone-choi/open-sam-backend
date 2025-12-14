/**
 * 격노 (激怒) - 전투 특기
 * PHP che_격노.php 기반
 * 
 * 효과:
 * - 상대 필살 시 격노(필살) 발동
 * - 상대 회피 시도 시 25% 확률로 격노 발동
 * - 공격 시 일정 확률로 진노 (1페이즈 추가)
 * - 격노 발동마다 데미지 20% 추가 중첩
 */

import {
  BattleSpecialityBase,
  IStatCalcContext,
  IWarPowerMultiplier,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';
import { BattleUnit } from '../../../battle/interfaces/Unit';

export class Gyukno extends BattleSpecialityBase {
  readonly id = 74;
  readonly name = '격노';
  readonly info =
    '[전투] 상대방 필살 시 격노(필살) 발동, 회피 시도시 25% 확률로 격노 발동, 공격 시 일정 확률로 진노(1페이즈 추가), 격노마다 대미지 20% 추가 중첩';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_STRENGTH];

  /**
   * 전투력 배수 계산
   * PHP: $activatedCnt = $unit->hasActivatedSkillOnLog('격노');
   * PHP: return [1 + 0.2*$activatedCnt, 1];
   */
  override getWarPowerMultiplier(
    unit: BattleUnit,
    _opponent?: BattleUnit
  ): IWarPowerMultiplier {
    // 격노 발동 횟수에 따른 데미지 증가
    const activatedCount = (unit as any).activatedSkillCount?.['격노'] ?? 0;
    return {
      attackMultiplier: 1 + 0.2 * activatedCount,
      defenseMultiplier: 1,
    };
  }
}





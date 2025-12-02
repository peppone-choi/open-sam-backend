/**
 * 척사 (斥邪) - 전투 특기
 * PHP che_척사.php 기반
 * 
 * 효과:
 * - 지역·도시 병종 상대로 대미지 +20%, 아군 피해 -20%
 */

import {
  BattleSpecialityBase,
  IWarPowerMultiplier,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';
import { BattleUnit } from '../../../battle/interfaces/Unit';

export class Cheoksa extends BattleSpecialityBase {
  readonly id = 75;
  readonly name = '척사';
  readonly info = '[전투] 지역·도시 병종 상대로 대미지 +20%, 아군 피해 -20%';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [
    StatRequirement.STAT_LEADERSHIP,
    StatRequirement.STAT_STRENGTH,
    StatRequirement.STAT_INTEL,
  ];

  /**
   * 전투력 배수 계산
   * 이민족/도시 병종 상대로 보너스
   */
  override getWarPowerMultiplier(
    _unit: BattleUnit,
    opponent?: BattleUnit
  ): IWarPowerMultiplier {
    // 상대가 지역/도시 병종인지 확인
    const isRegionalUnit = this.isRegionalOrCityUnit(opponent);

    if (isRegionalUnit) {
      return {
        attackMultiplier: 1.2,
        defenseMultiplier: 0.8,
      };
    }

    return {
      attackMultiplier: 1,
      defenseMultiplier: 1,
    };
  }

  /**
   * 지역/도시 병종인지 확인
   */
  private isRegionalOrCityUnit(opponent?: BattleUnit): boolean {
    if (!opponent) return false;

    // 유닛 타입에서 지역/도시 병종 확인
    const unitType = (opponent as any).unitType ?? '';
    const regionalTypes = ['regional', 'city', 'barbarian', 'native'];

    return regionalTypes.some((type) =>
      unitType.toLowerCase().includes(type)
    );
  }
}



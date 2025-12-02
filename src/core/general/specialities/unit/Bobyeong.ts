/**
 * 보병 (步兵) - 병종 특기
 * PHP che_보병.php 기반
 * 
 * 효과:
 * - 보병 전투력 +15%
 * - 보병 방어력 +20%
 * - 지형 적응력 보너스
 */

import {
  UnitSpecialityBase,
  IStatCalcContext,
  IWarPowerMultiplier,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';
import { BattleUnit } from '../../../battle/interfaces/Unit';

export class Bobyeong extends UnitSpecialityBase {
  readonly id = 71;
  readonly name = '보병';
  readonly info = '[병종] 보병 전투력 +15%, 방어력 +20%, 지형 적응력 보너스';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [
    StatRequirement.STAT_STRENGTH,
    StatRequirement.ARMY_FOOTMAN,
  ];

  /**
   * 보병 유닛인지 확인
   */
  override matchesUnitType(unitType: string): boolean {
    const footmanTypes = ['footman', '보병', 'infantry', '도보'];
    return footmanTypes.some((t) =>
      unitType.toLowerCase().includes(t.toLowerCase())
    );
  }

  /**
   * 스탯 계산
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    if (!this.matchesUnitType((ctx.unit as any).unitType ?? '')) {
      return ctx.baseValue;
    }

    switch (ctx.statName) {
      case 'terrainAdaptation':
      case 'terrainBonus':
        return ctx.baseValue + 0.15;
      case 'siegeDefense':
        return ctx.baseValue * 1.1;
      default:
        return ctx.baseValue;
    }
  }

  /**
   * 병종 전투력 보정
   */
  override getUnitPowerBonus(): IWarPowerMultiplier {
    return {
      attackMultiplier: 1.15,
      defenseMultiplier: 0.8, // 받는 데미지 -20%
    };
  }

  /**
   * 전투력 배수 (보병일 때만)
   */
  getWarPowerMultiplier(
    unit: BattleUnit,
    _opponent?: BattleUnit
  ): IWarPowerMultiplier {
    const unitType = (unit as any).unitType ?? '';

    if (this.matchesUnitType(unitType)) {
      return this.getUnitPowerBonus();
    }

    return {
      attackMultiplier: 1,
      defenseMultiplier: 1,
    };
  }
}



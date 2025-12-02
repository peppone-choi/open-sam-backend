/**
 * 기병 (騎兵) - 병종 특기
 * PHP che_기병.php 기반
 * 
 * 효과:
 * - 기병 전투력 +20%
 * - 기병 이동력 +1
 * - 기병 사용 시 돌격 데미지 +15%
 */

import {
  UnitSpecialityBase,
  IStatCalcContext,
  IWarPowerMultiplier,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';
import { BattleUnit } from '../../../battle/interfaces/Unit';

export class Gibyeong extends UnitSpecialityBase {
  readonly id = 70;
  readonly name = '기병';
  readonly info = '[병종] 기병 전투력 +20%, 이동력 +1, 돌격 데미지 +15%';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [
    StatRequirement.STAT_STRENGTH,
    StatRequirement.ARMY_CAVALRY,
  ];

  /**
   * 기병 유닛인지 확인
   */
  override matchesUnitType(unitType: string): boolean {
    const cavalryTypes = ['cavalry', '기병', 'horse', '마병'];
    return cavalryTypes.some((t) =>
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
      case 'speed':
      case 'mobility':
      case 'moveSpeed':
        return ctx.baseValue + 1;
      case 'chargeDamage':
      case 'rushDamage':
        return ctx.baseValue * 1.15;
      default:
        return ctx.baseValue;
    }
  }

  /**
   * 병종 전투력 보정
   */
  override getUnitPowerBonus(): IWarPowerMultiplier {
    return {
      attackMultiplier: 1.2,
      defenseMultiplier: 1.1,
    };
  }

  /**
   * 병종 이동력 보정
   */
  override getUnitMobilityBonus(): number {
    return 1;
  }

  /**
   * 전투력 배수 (기병일 때만)
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



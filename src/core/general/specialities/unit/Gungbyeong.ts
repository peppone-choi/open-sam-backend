/**
 * 궁병 (弓兵) - 병종 특기
 * PHP che_궁병.php 기반
 * 
 * 효과:
 * - 궁병 전투력 +20%
 * - 궁병 사거리 +1
 * - 궁병 명중률 +15%
 */

import {
  UnitSpecialityBase,
  IStatCalcContext,
  IWarPowerMultiplier,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';
import { BattleUnit } from '../../../battle/interfaces/Unit';

export class Gungbyeong extends UnitSpecialityBase {
  readonly id = 72;
  readonly name = '궁병';
  readonly info = '[병종] 궁병 전투력 +20%, 사거리 +1, 명중률 +15%';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [
    StatRequirement.STAT_STRENGTH,
    StatRequirement.ARMY_ARCHER,
  ];

  /**
   * 궁병 유닛인지 확인
   */
  override matchesUnitType(unitType: string): boolean {
    const archerTypes = ['archer', '궁병', 'bow', '노병', '석궁'];
    return archerTypes.some((t) =>
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
      case 'attackRange':
      case 'range':
        return ctx.baseValue + 1;
      case 'accuracy':
      case 'hitRate':
        return ctx.baseValue + 0.15;
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
      defenseMultiplier: 1,
    };
  }

  /**
   * 전투력 배수 (궁병일 때만)
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



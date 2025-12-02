/**
 * 수군 (水軍) - 병종 특기
 * 
 * 효과:
 * - 수군 전투력 +25%
 * - 수상 이동력 +2
 * - 수상 전투 시 적 이동력 감소
 */

import {
  UnitSpecialityBase,
  IStatCalcContext,
  IWarPowerMultiplier,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';
import { BattleUnit } from '../../../battle/interfaces/Unit';

export class Sugun extends UnitSpecialityBase {
  readonly id = 74;
  readonly name = '수군';
  readonly info = '[병종] 수군 전투력 +25%, 수상 이동력 +2, 적 이동력 감소';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_LEADERSHIP];

  /**
   * 수군 유닛인지 확인
   */
  override matchesUnitType(unitType: string): boolean {
    const navalTypes = ['naval', '수군', 'ship', '선박', '함선', '누선'];
    return navalTypes.some((t) =>
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
      case 'waterSpeed':
      case 'navalMobility':
        return ctx.baseValue + 2;
      case 'waterBattleBonus':
        return ctx.baseValue + 0.15;
      default:
        return ctx.baseValue;
    }
  }

  /**
   * 상대 스탯 계산 (수상 전투 시 적 이동력 감소)
   */
  override onCalcOpposeStat(ctx: IStatCalcContext): number {
    // 수상 전투에서 적 이동력 감소
    if (ctx.statName === 'waterSpeed' || ctx.statName === 'navalMobility') {
      return ctx.baseValue * 0.85; // -15%
    }
    return ctx.baseValue;
  }

  /**
   * 병종 전투력 보정
   */
  override getUnitPowerBonus(): IWarPowerMultiplier {
    return {
      attackMultiplier: 1.25,
      defenseMultiplier: 1.1,
    };
  }

  /**
   * 병종 이동력 보정
   */
  override getUnitMobilityBonus(): number {
    return 2;
  }

  /**
   * 전투력 배수 (수군일 때만)
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



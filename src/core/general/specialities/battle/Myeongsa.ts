/**
 * 명사 (名射) - 전투 특기
 * 
 * 효과:
 * - 원거리 공격력 +20%
 * - 공격 사거리 +1
 * - 궁병 사용 시 치명타 확률 +15%
 */

import {
  BattleSpecialityBase,
  IStatCalcContext,
  IWarPowerMultiplier,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';
import { BattleUnit } from '../../../battle/interfaces/Unit';

export class Myeongsa extends BattleSpecialityBase {
  readonly id = 47;
  readonly name = '명사';
  readonly info =
    '[전투] 원거리 공격력 +20%, 공격 사거리 +1, 궁병 치명타 확률 +15%';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [
    StatRequirement.STAT_STRENGTH,
    StatRequirement.ARMY_ARCHER,
  ];

  /**
   * 스탯 계산
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    switch (ctx.statName) {
      case 'attackRange':
        return ctx.baseValue + 1;
      case 'rangedAttackPower':
        return ctx.baseValue * 1.2;
      case 'criticalRate':
        // 궁병일 때만 적용
        if (this.isArcherUnit(ctx.unit)) {
          return ctx.baseValue + 0.15;
        }
        return ctx.baseValue;
      default:
        return ctx.baseValue;
    }
  }

  /**
   * 전투력 배수 계산
   */
  override getWarPowerMultiplier(
    unit: BattleUnit,
    _opponent?: BattleUnit
  ): IWarPowerMultiplier {
    // 궁병일 때 공격력 보너스
    if (this.isArcherUnit(unit)) {
      return {
        attackMultiplier: 1.2,
        defenseMultiplier: 1,
      };
    }

    return {
      attackMultiplier: 1.1, // 일반 원거리 공격도 약간 보너스
      defenseMultiplier: 1,
    };
  }

  /**
   * 크리티컬 확률 보정
   */
  override getCriticalRateBonus(baseRate: number, _isAttacker: boolean): number {
    return baseRate + 0.1; // 기본 +10%
  }

  /**
   * 궁병 유닛인지 확인
   */
  private isArcherUnit(unit: BattleUnit): boolean {
    const unitType = (unit as any).unitType ?? '';
    return unitType.toLowerCase().includes('archer');
  }
}



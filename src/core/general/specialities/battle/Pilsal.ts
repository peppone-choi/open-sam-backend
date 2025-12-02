/**
 * 필살 (必殺) - 전투 특기
 * PHP che_필살.php 기반
 * 
 * 효과:
 * - 치명타 확률 +20%
 * - 치명타 데미지 +30%
 * - 체력이 낮을수록 치명타 확률 추가 증가
 */

import {
  BattleSpecialityBase,
  IStatCalcContext,
  IWarPowerMultiplier,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';
import { BattleUnit } from '../../../battle/interfaces/Unit';

export class Pilsal extends BattleSpecialityBase {
  readonly id = 50;
  readonly name = '필살';
  readonly info =
    '[전투] 치명타 확률 +20%, 치명타 데미지 +30%, HP가 낮을수록 치명타 확률 증가';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_STRENGTH];

  /**
   * 스탯 계산
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    switch (ctx.statName) {
      case 'criticalRate':
      case 'warCriticalRatio':
        // 기본 +20%, HP 비율에 따라 추가 보너스
        const hpBonus = this.calculateHpBonus(ctx.unit);
        return ctx.baseValue + 0.2 + hpBonus;
      case 'criticalDamage':
      case 'criticalMultiplier':
        return ctx.baseValue + 0.3;
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
    // HP가 낮을수록 공격력 약간 증가
    const hpRatio = this.getHpRatio(unit);
    const attackBonus = hpRatio < 0.5 ? 1.1 : 1;

    return {
      attackMultiplier: attackBonus,
      defenseMultiplier: 1,
    };
  }

  /**
   * 크리티컬 확률 보정
   */
  override getCriticalRateBonus(baseRate: number, _isAttacker: boolean): number {
    return baseRate + 0.2;
  }

  /**
   * HP 비율에 따른 추가 치명타 확률
   */
  private calculateHpBonus(unit: BattleUnit): number {
    const hpRatio = this.getHpRatio(unit);

    // HP가 낮을수록 보너스 증가 (최대 +15%)
    if (hpRatio < 0.25) return 0.15;
    if (hpRatio < 0.5) return 0.1;
    if (hpRatio < 0.75) return 0.05;
    return 0;
  }

  /**
   * HP 비율 계산
   */
  private getHpRatio(unit: BattleUnit): number {
    const hp = (unit as any).hp ?? (unit as any).troops ?? 100;
    const maxHp = (unit as any).maxHp ?? (unit as any).maxTroops ?? 100;
    return hp / Math.max(1, maxHp);
  }
}



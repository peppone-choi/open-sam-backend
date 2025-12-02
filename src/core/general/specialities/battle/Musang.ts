/**
 * 무쌍 (無雙) - 전투 특기
 * PHP che_무쌍.php 기반
 * 
 * 효과:
 * - 대미지 +5%, 피해 -2%
 * - 공격 시 필살 확률 +10%p
 * - 승리 수의 로그 비례로 대미지 상승 (10회 ⇒ +5%, 40회 ⇒ +15%)
 * - 승리 수의 로그 비례로 피해 감소 (10회 ⇒ -2%, 40회 ⇒ -6%)
 */

import {
  BattleSpecialityBase,
  IStatCalcContext,
  IWarPowerMultiplier,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';
import { BattleUnit } from '../../../battle/interfaces/Unit';

export class Musang extends BattleSpecialityBase {
  readonly id = 61;
  readonly name = '무쌍';
  readonly info =
    '[전투] 대미지 +5%, 피해 -2%, 공격 시 필살 확률 +10%p, ' +
    '승리 수의 로그 비례로 대미지 상승(10회 ⇒ +5%, 40회 ⇒ +15%), ' +
    '승리 수의 로그 비례로 피해 감소(10회 ⇒ -2%, 40회 ⇒ -6%)';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_STRENGTH];

  /**
   * 스탯 계산 - 필살 확률 보정
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    if (ctx.statName === 'warCriticalRatio' && ctx.isAttacker) {
      return ctx.baseValue + 0.1; // +10%p
    }
    return ctx.baseValue;
  }

  /**
   * 전투력 배수 계산
   */
  override getWarPowerMultiplier(
    unit: BattleUnit,
    _opponent?: BattleUnit
  ): IWarPowerMultiplier {
    // 기본 보정
    let attackMultiplier = 1.05;
    let defenseMultiplier = 0.98;

    // 승리 수 기반 추가 보정
    const killnum = (unit as any).killCount ?? 0;
    const logBonus = Math.log2(Math.max(1, killnum / 5));

    attackMultiplier += logBonus / 20;
    defenseMultiplier -= logBonus / 50;

    return {
      attackMultiplier,
      defenseMultiplier: Math.max(0.8, defenseMultiplier),
    };
  }

  /**
   * 크리티컬 확률 보정 (공격자일 때만)
   */
  override getCriticalRateBonus(baseRate: number, isAttacker: boolean): number {
    if (isAttacker) {
      return baseRate + 0.1;
    }
    return baseRate;
  }
}



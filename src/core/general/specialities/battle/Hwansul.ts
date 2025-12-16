/**
 * 환술 (幻術) - 전투 특기
 * PHP che_환술.php 기반
 * 
 * 효과:
 * - [전투] 계략 성공 확률 +10%p
 * - [전투] 계략 성공 시 대미지 +30%
 */

import {
  BattleSpecialityBase,
  IStatCalcContext,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

export class Hwansul extends BattleSpecialityBase {
  readonly id = 42;
  readonly name = '환술';
  readonly info = '[전투] 계략 성공 확률 +10%p, 계략 성공 시 대미지 +30%';

  static override selectWeightType = SelectWeightType.PERCENT;
  static override selectWeight = 5;
  static override requirements = [StatRequirement.STAT_INTEL];

  /**
   * 스탯 계산
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    const { statName, baseValue } = ctx;
    
    // 계략 성공 확률 +10%p
    if (statName === 'warMagicSuccessProb') {
      return baseValue + 0.1;
    }
    
    // 계략 성공 시 대미지 +30%
    if (statName === 'warMagicSuccessDamage') {
      return baseValue * 1.3;
    }
    
    return baseValue;
  }
}








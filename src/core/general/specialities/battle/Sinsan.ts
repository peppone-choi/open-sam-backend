/**
 * 신산 (神算) - 전투 특기
 * PHP che_신산.php 기반
 * 
 * 효과:
 * - [계략] 화계·탈취·파괴·선동 : 성공률 +10%p
 * - [전투] 계략 시도 확률 +20%p
 * - [전투] 계략 성공 확률 +20%p
 */

import {
  BattleSpecialityBase,
  IStatCalcContext,
  IDomesticCalcContext,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

export class Sinsan extends BattleSpecialityBase {
  readonly id = 41;
  readonly name = '신산';
  readonly info =
    '[계략] 화계·탈취·파괴·선동 : 성공률 +10%p<br>[전투] 계략 시도 확률 +20%p, 계략 성공 확률 +20%p';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_INTEL];

  /**
   * 내정 계산 - 계략 성공률 +10%p
   */
  override onCalcDomestic(ctx: IDomesticCalcContext): number {
    const { turnType, varType, baseValue } = ctx;
    
    if (turnType === '계략') {
      if (varType === 'success') {
        return baseValue + 0.1;
      }
    }
    
    return baseValue;
  }

  /**
   * 스탯 계산
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    const { statName, baseValue } = ctx;
    
    // 계략 시도 확률 +20%p
    if (statName === 'warMagicTrialProb') {
      return baseValue + 0.2;
    }
    
    // 계략 성공 확률 +20%p
    if (statName === 'warMagicSuccessProb') {
      return baseValue + 0.2;
    }
    
    return baseValue;
  }
}











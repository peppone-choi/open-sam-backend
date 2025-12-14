/**
 * 반계 (反計) - 전투 특기
 * PHP che_반계.php 기반
 * 
 * 효과:
 * - [전투] 상대의 계략 성공 확률 -10%p
 * - [전투] 상대의 계략을 40% 확률로 되돌림
 * - [전투] 반목 성공시 대미지 추가 (+60% → +150%)
 */

import {
  BattleSpecialityBase,
  IStatCalcContext,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

export class Bangye extends BattleSpecialityBase {
  readonly id = 45;
  readonly name = '반계';
  readonly info =
    '[전투] 상대의 계략 성공 확률 -10%p, 상대의 계략을 40% 확률로 되돌림, 반목 성공시 대미지 추가(+60% → +150%)';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_INTEL];

  /**
   * 스탯 계산
   * PHP: 반목 성공 시 추가 데미지 +0.9 (총 +150%)
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    const { statName, baseValue } = ctx;
    
    // 반목 계략 성공 시 데미지 증가
    if (statName === 'warMagicSuccessDamage' && (ctx as any).aux === '반목') {
      return baseValue + 0.9;
    }
    
    return baseValue;
  }

  /**
   * 상대 스탯 디버프
   * PHP: 상대 계략 성공 확률 -10%p
   */
  override onCalcOpposeStat(ctx: IStatCalcContext): number {
    const { statName, baseValue } = ctx;
    
    if (statName === 'warMagicSuccessProb') {
      return baseValue - 0.1;
    }
    
    return baseValue;
  }
}





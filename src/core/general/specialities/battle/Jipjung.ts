/**
 * 집중 (集中) - 전투 특기
 * PHP che_집중.php 기반
 * 
 * 효과:
 * - [전투] 계략 성공 시 대미지 +50%
 */

import {
  BattleSpecialityBase,
  IStatCalcContext,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

export class Jipjung extends BattleSpecialityBase {
  readonly id = 43;
  readonly name = '집중';
  readonly info = '[전투] 계략 성공 시 대미지 +50%';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_INTEL];

  /**
   * 스탯 계산
   * PHP: 계략 성공 시 데미지 * 1.5
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    const { statName, baseValue } = ctx;
    
    if (statName === 'warMagicSuccessDamage') {
      return baseValue * 1.5;
    }
    
    return baseValue;
  }
}









/**
 * 신중 (愼重) - 전투 특기
 * PHP che_신중.php 기반
 * 
 * 효과:
 * - 계략 성공 확률 100%
 */

import {
  BattleSpecialityBase,
  IStatCalcContext,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

export class Sinjung extends BattleSpecialityBase {
  readonly id = 44;
  readonly name = '신중';
  readonly info = '[전투] 계략 성공 확률 100%';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_INTEL];

  /**
   * 스탯 계산 - 계략 성공 확률 100%
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    if (ctx.statName === 'warMagicSuccessProb') {
      return ctx.baseValue + 1; // 100% 보장
    }
    return ctx.baseValue;
  }
}



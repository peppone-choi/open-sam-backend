/**
 * 징병 (徵兵) - 전투 특기
 * PHP che_징병.php 기반
 * 
 * 효과:
 * - [군사] 징병/모병 시 훈사 70/84 제공
 * - [기타] 통솔 순수 능력치 보정 +25%
 * - [기타] 징병/모병/소집해제 시 인구 변동 없음
 */

import {
  BattleSpecialityBase,
  IStatCalcContext,
  IDomesticCalcContext,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

export class Jingbyeong extends BattleSpecialityBase {
  readonly id = 72;
  readonly name = '징병';
  readonly info =
    '[군사] 징병/모병 시 훈사 70/84 제공<br>[기타] 통솔 순수 능력치 보정 +25%, 징병/모병/소집해제 시 인구 변동 없음';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [
    StatRequirement.STAT_LEADERSHIP,
    StatRequirement.STAT_STRENGTH,
    StatRequirement.STAT_INTEL,
  ];

  /**
   * 내정 계산
   */
  override onCalcDomestic(ctx: IDomesticCalcContext): number {
    const { turnType, varType, baseValue } = ctx;
    
    // 징병 시 훈련/사기 70
    if (turnType === '징병') {
      if (varType === 'train' || varType === 'atmos') {
        return 70;
      }
    }
    
    // 모병 시 훈련/사기 84
    if (turnType === '모병') {
      if (varType === 'train' || varType === 'atmos') {
        return 84;
      }
    }
    
    // 징집인구 변동 없음
    if (turnType === '징집인구' && varType === 'score') {
      return 0;
    }
    
    return baseValue;
  }

  /**
   * 스탯 계산 - 통솔 +25%
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    const { statName, baseValue, unit } = ctx;
    
    // 통솔 순수 능력치 +25%
    if (statName === 'leadership') {
      const rawLeadership = (unit as any).leadership ?? (unit as any).data?.leadership ?? 0;
      return baseValue + rawLeadership * 0.25;
    }
    
    return baseValue;
  }
}





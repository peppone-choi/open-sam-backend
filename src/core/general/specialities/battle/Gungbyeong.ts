/**
 * 궁병 (弓兵) - 전투 특기
 * PHP che_궁병.php 기반
 * 
 * 효과:
 * - [군사] 궁병 계통 징·모병비 -10%
 * - [전투] 회피 확률 +20%p
 * - 공격시 상대 병종에/수비시 자신 병종 숙련에 궁병 숙련을 가산
 */

import {
  BattleSpecialityBase,
  IStatCalcContext,
  IDomesticCalcContext,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

// 병종 상수 (PHP GameUnitConst::T_ARCHER)
const T_ARCHER = 2;

export class Gungbyeong extends BattleSpecialityBase {
  readonly id = 51;
  readonly name = '궁병';
  readonly info =
    '[군사] 궁병 계통 징·모병비 -10%<br>[전투] 회피 확률 +20%p,<br>공격시 상대 병종에/수비시 자신 병종 숙련에 궁병 숙련을 가산';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [
    StatRequirement.STAT_LEADERSHIP | StatRequirement.REQ_DEXTERITY | StatRequirement.ARMY_ARCHER | StatRequirement.STAT_NOT_INTEL,
    StatRequirement.STAT_STRENGTH | StatRequirement.REQ_DEXTERITY | StatRequirement.ARMY_ARCHER,
  ];

  /**
   * 내정 계산 - 궁병 징모병비 -10%
   */
  override onCalcDomestic(ctx: IDomesticCalcContext): number {
    const { turnType, varType, baseValue } = ctx;
    
    if (['징병', '모병'].includes(turnType)) {
      if (varType === 'cost' && (ctx as any).armType === T_ARCHER) {
        return baseValue * 0.9;
      }
    }
    
    return baseValue;
  }

  /**
   * 스탯 계산
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    const { statName, baseValue, unit, isAttacker } = ctx;
    
    // 회피 확률 +20%p
    if (statName === 'warAvoidRatio') {
      return baseValue + 0.2;
    }
    
    // 숙련도 계산
    if (statName.startsWith('dex')) {
      const myArmType = `dex${T_ARCHER}`;
      const opposeArmType = `dex${(ctx as any).opposeType?.armType}`;
      
      // 공격시 상대 병종에 궁병 숙련 가산
      if (isAttacker && opposeArmType === statName) {
        const myDex = (unit as any)[myArmType] ?? 0;
        return baseValue + myDex;
      }
      
      // 수비시 자신 병종에 궁병 숙련 가산
      if (!isAttacker && myArmType === statName) {
        const myDex = (unit as any)[myArmType] ?? 0;
        return baseValue + myDex;
      }
    }
    
    return baseValue;
  }

  /**
   * 회피 확률 보정
   */
  override getEvasionRateBonus(baseRate: number): number {
    return baseRate + 0.2;
  }
}







/**
 * 귀병 (鬼兵) - 전투 특기
 * PHP che_귀병.php 기반
 * 
 * 효과:
 * - [군사] 귀병 계통 징·모병비 -10%
 * - [전투] 계략 성공 확률 +20%p
 * - 공격시 상대 병종에/수비시 자신 병종 숙련에 귀병 숙련을 가산
 */

import {
  BattleSpecialityBase,
  IStatCalcContext,
  IDomesticCalcContext,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';

// 병종 상수 (PHP GameUnitConst::T_WIZARD)
const T_WIZARD = 4;

export class Gwibyeong extends BattleSpecialityBase {
  readonly id = 40;
  readonly name = '귀병';
  readonly info =
    '[군사] 귀병 계통 징·모병비 -10%<br>[전투] 계략 성공 확률 +20%p,<br>공격시 상대 병종에/수비시 자신 병종 숙련에 귀병 숙련을 가산';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [
    StatRequirement.STAT_INTEL | StatRequirement.ARMY_WIZARD | StatRequirement.REQ_DEXTERITY | StatRequirement.STAT_NOT_STRENGTH,
  ];

  /**
   * 내정 계산 - 귀병 징모병비 -10%
   */
  override onCalcDomestic(ctx: IDomesticCalcContext): number {
    const { turnType, varType, baseValue } = ctx;
    
    if (['징병', '모병'].includes(turnType)) {
      if (varType === 'cost' && (ctx as any).armType === T_WIZARD) {
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
    
    // 계략 성공 확률 +20%p
    if (statName === 'warMagicSuccessProb') {
      return baseValue + 0.2;
    }
    
    // 숙련도 계산
    if (statName.startsWith('dex')) {
      const myArmType = `dex${T_WIZARD}`;
      const opposeArmType = `dex${(ctx as any).opposeType?.armType}`;
      
      // 공격시 상대 병종에 귀병 숙련 가산
      if (isAttacker && opposeArmType === statName) {
        const myDex = (unit as any)[myArmType] ?? 0;
        return baseValue + myDex;
      }
      
      // 수비시 자신 병종에 귀병 숙련 가산
      if (!isAttacker && myArmType === statName) {
        const myDex = (unit as any)[myArmType] ?? 0;
        return baseValue + myDex;
      }
    }
    
    return baseValue;
  }
}







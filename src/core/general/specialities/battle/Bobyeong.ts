/**
 * 보병 (步兵) - 전투 특기
 * PHP che_보병.php 기반
 * 
 * 효과:
 * - [군사] 보병 계통 징·모병비 -10%
 * - [전투] 공격 시 아군 피해 -10%, 수비 시 아군 피해 -20%
 * - 공격시 상대 병종에/수비시 자신 병종 숙련에 보병 숙련을 가산
 */

import {
  BattleSpecialityBase,
  IStatCalcContext,
  IDomesticCalcContext,
  IWarPowerMultiplier,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';
import { BattleUnit } from '../../../battle/interfaces/Unit';

// 병종 상수 (PHP GameUnitConst::T_FOOTMAN)
const T_FOOTMAN = 1;

export class Bobyeong extends BattleSpecialityBase {
  readonly id = 50;
  readonly name = '보병';
  readonly info =
    '[군사] 보병 계통 징·모병비 -10%<br>[전투] 공격 시 아군 피해 -10%, 수비 시 아군 피해 -20%,<br>공격시 상대 병종에/수비시 자신 병종 숙련에 보병 숙련을 가산';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [
    StatRequirement.STAT_LEADERSHIP | StatRequirement.REQ_DEXTERITY | StatRequirement.ARMY_FOOTMAN | StatRequirement.STAT_NOT_INTEL,
    StatRequirement.STAT_STRENGTH | StatRequirement.REQ_DEXTERITY | StatRequirement.ARMY_FOOTMAN,
  ];

  /**
   * 내정 계산 - 보병 징모병비 -10%
   */
  override onCalcDomestic(ctx: IDomesticCalcContext): number {
    const { turnType, varType, baseValue } = ctx;
    
    if (['징병', '모병'].includes(turnType)) {
      if (varType === 'cost' && (ctx as any).armType === T_FOOTMAN) {
        return baseValue * 0.9;
      }
    }
    
    return baseValue;
  }

  /**
   * 전투력 배수 계산
   * PHP: 공격 시 아군 피해 -10%, 수비 시 -20%
   * defenseMultiplier는 자신이 받는 피해 감소
   */
  override getWarPowerMultiplier(
    unit: BattleUnit,
    _opponent?: BattleUnit
  ): IWarPowerMultiplier {
    const isAttacker = (unit as any).isAttacker ?? true;
    
    if (isAttacker) {
      return {
        attackMultiplier: 1,
        defenseMultiplier: 0.9, // 받는 피해 -10%
      };
    }
    
    return {
      attackMultiplier: 1,
      defenseMultiplier: 0.8, // 받는 피해 -20%
    };
  }

  /**
   * 스탯 계산 - 숙련도 가산
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    const { statName, baseValue, unit, isAttacker } = ctx;
    
    // 숙련도 계산
    if (statName.startsWith('dex')) {
      const myArmType = `dex${T_FOOTMAN}`;
      const opposeArmType = `dex${(ctx as any).opposeType?.armType}`;
      
      // 공격시 상대 병종에 보병 숙련 가산
      if (isAttacker && opposeArmType === statName) {
        const myDex = (unit as any)[myArmType] ?? 0;
        return baseValue + myDex;
      }
      
      // 수비시 자신 병종에 보병 숙련 가산
      if (!isAttacker && myArmType === statName) {
        const myDex = (unit as any)[myArmType] ?? 0;
        return baseValue + myDex;
      }
    }
    
    return baseValue;
  }
}









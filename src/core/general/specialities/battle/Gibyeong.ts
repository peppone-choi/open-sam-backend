/**
 * 기병 (騎兵) - 전투 특기
 * PHP che_기병.php 기반
 * 
 * 효과:
 * - [군사] 기병 계통 징·모병비 -10%
 * - [전투] 수비 시 대미지 +10%, 공격 시 대미지 +20%
 * - 공격시 상대 병종에/수비시 자신 병종 숙련에 기병 숙련을 가산
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

// 병종 상수 (PHP GameUnitConst::T_CAVALRY)
const T_CAVALRY = 3;

export class Gibyeong extends BattleSpecialityBase {
  readonly id = 52;
  readonly name = '기병';
  readonly info =
    '[군사] 기병 계통 징·모병비 -10%<br>[전투] 수비 시 대미지 +10%, 공격 시 대미지 +20%,<br>공격시 상대 병종에/수비시 자신 병종 숙련에 기병 숙련을 가산';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [
    StatRequirement.STAT_LEADERSHIP | StatRequirement.REQ_DEXTERITY | StatRequirement.ARMY_CAVALRY | StatRequirement.STAT_NOT_INTEL,
    StatRequirement.STAT_STRENGTH | StatRequirement.REQ_DEXTERITY | StatRequirement.ARMY_CAVALRY,
  ];

  /**
   * 내정 계산 - 기병 징모병비 -10%
   */
  override onCalcDomestic(ctx: IDomesticCalcContext): number {
    const { turnType, varType, baseValue } = ctx;
    
    if (['징병', '모병'].includes(turnType)) {
      if (varType === 'cost' && (ctx as any).armType === T_CAVALRY) {
        return baseValue * 0.9;
      }
    }
    
    return baseValue;
  }

  /**
   * 전투력 배수 계산
   * PHP: 공격 시 +20%, 수비 시 +10%
   */
  override getWarPowerMultiplier(
    unit: BattleUnit,
    _opponent?: BattleUnit
  ): IWarPowerMultiplier {
    const isAttacker = (unit as any).isAttacker ?? true;
    
    if (isAttacker) {
      return {
        attackMultiplier: 1.2,
        defenseMultiplier: 1,
      };
    }
    
    return {
      attackMultiplier: 1.1,
      defenseMultiplier: 1,
    };
  }

  /**
   * 스탯 계산 - 숙련도 가산
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    const { statName, baseValue, unit, isAttacker } = ctx;
    
    // 숙련도 계산
    if (statName.startsWith('dex')) {
      const myArmType = `dex${T_CAVALRY}`;
      const opposeArmType = `dex${(ctx as any).opposeType?.armType}`;
      
      // 공격시 상대 병종에 기병 숙련 가산
      if (isAttacker && opposeArmType === statName) {
        const myDex = (unit as any)[myArmType] ?? 0;
        return baseValue + myDex;
      }
      
      // 수비시 자신 병종에 기병 숙련 가산
      if (!isAttacker && myArmType === statName) {
        const myDex = (unit as any)[myArmType] ?? 0;
        return baseValue + myDex;
      }
    }
    
    return baseValue;
  }
}









/**
 * 공성 (攻城) - 전투 특기
 * PHP che_공성.php 기반
 * 
 * 효과:
 * - [군사] 차병 계통 징·모병비 -10%
 * - [전투] 성벽 공격 시 대미지 +100%
 * - 공격시 상대 병종에/수비시 자신 병종 숙련에 차병 숙련을 가산
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

// 병종 상수 (PHP GameUnitConst::T_SIEGE)
const T_SIEGE = 5;

export class Gongseong extends BattleSpecialityBase {
  readonly id = 53;
  readonly name = '공성';
  readonly info =
    '[군사] 차병 계통 징·모병비 -10%<br>[전투] 성벽 공격 시 대미지 +100%,<br>공격시 상대 병종에/수비시 자신 병종 숙련에 차병 숙련을 가산';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [
    StatRequirement.STAT_LEADERSHIP | StatRequirement.REQ_DEXTERITY | StatRequirement.ARMY_SIEGE,
  ];

  /**
   * 내정 계산 - 차병 징모병비 -10%
   */
  override onCalcDomestic(ctx: IDomesticCalcContext): number {
    const { turnType, varType, baseValue } = ctx;
    
    if (['징병', '모병'].includes(turnType)) {
      if (varType === 'cost' && (ctx as any).armType === T_SIEGE) {
        return baseValue * 0.9;
      }
    }
    
    return baseValue;
  }

  /**
   * 전투력 배수 계산
   * PHP: 성벽 공격 시 대미지 +100%
   */
  override getWarPowerMultiplier(
    unit: BattleUnit,
    opponent?: BattleUnit
  ): IWarPowerMultiplier {
    // 상대가 성벽(도시)인 경우 데미지 2배
    const isAgainstCity = (opponent as any)?.unitType === 'city' || (opponent as any)?.isCity;
    
    if (isAgainstCity) {
      return {
        attackMultiplier: 2,
        defenseMultiplier: 1,
      };
    }
    
    return {
      attackMultiplier: 1,
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
      const myArmType = `dex${T_SIEGE}`;
      const opposeArmType = `dex${(ctx as any).opposeType?.armType}`;
      
      // 공격시 상대 병종에 차병 숙련 가산
      if (isAttacker && opposeArmType === statName) {
        const myDex = (unit as any)[myArmType] ?? 0;
        return baseValue + myDex;
      }
      
      // 수비시 자신 병종에 차병 숙련 가산
      if (!isAttacker && myArmType === statName) {
        const myDex = (unit as any)[myArmType] ?? 0;
        return baseValue + myDex;
      }
    }
    
    return baseValue;
  }
}


import type { WarUnit } from '../../../battle/WarUnit';
import { BaseSpecialWar } from '../BaseSpecialWar';
import { ARM_TYPE } from '../../../const/GameUnitConst';
import { adjustRecruitCostByArmType, applyCrewDexShare } from '../specialWarUtils';

export class CheGibyeongSpecialWar extends BaseSpecialWar {
  constructor() {
    super('che_기병', '기병', '[군사] 기병 계열 징·모병비 -10% / [전투] 공격 대미지 +20%, 수비 피해 -10%, 숙련 공유');
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    return adjustRecruitCostByArmType(turnType, varType, value, aux, ARM_TYPE.CAVALRY);
  }

  override getWarPowerMultiplier(unit: WarUnit): [number, number] {
    if (unit?.isAttackerUnit?.()) {
      return [1.2, 1];
    }
    return [1.1, 1];
  }

  override onCalcStat(general: any, statName: string, value: number, aux?: any): number {
    return applyCrewDexShare(general, statName, value, aux, ARM_TYPE.CAVALRY);
  }
}

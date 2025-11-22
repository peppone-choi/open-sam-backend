import type { WarUnit } from '../../../battle/WarUnit';
import { BaseSpecialWar } from '../BaseSpecialWar';
import { ARM_TYPE } from '../../../const/GameUnitConst';
import { adjustRecruitCostByArmType, applyCrewDexShare } from '../specialWarUtils';

export class CheBobyeongSpecialWar extends BaseSpecialWar {
  constructor() {
    super('che_보병', '보병', '[군사] 보병 계열 징·모병비 -10% / [전투] 공격 피해 -10%, 수비 피해 -20%, 숙련 공유');
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    return adjustRecruitCostByArmType(turnType, varType, value, aux, ARM_TYPE.FOOTMAN);
  }

  override getWarPowerMultiplier(unit: WarUnit): [number, number] {
    if (unit?.isAttackerUnit?.()) {
      return [1, 0.9];
    }
    return [1, 0.8];
  }

  override onCalcStat(general: any, statName: string, value: number, aux?: any): number {
    return applyCrewDexShare(general, statName, value, aux, ARM_TYPE.FOOTMAN);
  }
}

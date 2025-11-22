import type { WarUnit } from '../../../battle/WarUnit';
import { WarUnitCity } from '../../../battle/WarUnitCity';
import { BaseSpecialWar } from '../BaseSpecialWar';
import { ARM_TYPE } from '../../../const/GameUnitConst';
import { adjustRecruitCostByArmType, applyCrewDexShare } from '../specialWarUtils';

export class CheGongseongSpecialWar extends BaseSpecialWar {
  constructor() {
    super('che_공성', '공성', '[군사] 차병 계열 징·모병비 -10% / [전투] 성벽 상대 대미지 +100%, 숙련 공유');
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    return adjustRecruitCostByArmType(turnType, varType, value, aux, ARM_TYPE.SIEGE);
  }

  override onCalcStat(general: any, statName: string, value: number, aux?: any): number {
    return applyCrewDexShare(general, statName, value, aux, ARM_TYPE.SIEGE);
  }

  override getWarPowerMultiplier(unit: WarUnit): [number, number] {
    if (unit.getOppose() instanceof WarUnitCity) {
      return [2, 1];
    }
    return [1, 1];
  }
}

import { BaseSpecialWar } from '../BaseSpecialWar';
import { ARM_TYPE } from '../../../const/GameUnitConst';
import { adjustRecruitCostByArmType, applyCrewDexShare } from '../specialWarUtils';

export class CheGungbyeongSpecialWar extends BaseSpecialWar {
  constructor() {
    super('che_궁병', '궁병', '[군사] 궁병 계열 징·모병비 -10% / [전투] 회피 확률 +20%p, 숙련 공유');
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    return adjustRecruitCostByArmType(turnType, varType, value, aux, ARM_TYPE.ARCHER);
  }

  override onCalcStat(general: any, statName: string, value: number, aux?: any): number {
    if (statName === 'warAvoidRatio') {
      return value + 0.2;
    }
    return applyCrewDexShare(general, statName, value, aux, ARM_TYPE.ARCHER);
  }
}

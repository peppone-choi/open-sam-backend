import { BaseSpecialWar } from '../BaseSpecialWar';
import { ARM_TYPE } from '../../../const/GameUnitConst';
import { adjustRecruitCostByArmType, applyCrewDexShare } from '../specialWarUtils';

export class CheGwibyeongSpecialWar extends BaseSpecialWar {
  constructor() {
    super('che_귀병', '귀병', '[군사] 귀병 계열 징·모병비 -10% / [전투] 계략 성공 확률 +20%p, 병종 숙련 공유');
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    return adjustRecruitCostByArmType(turnType, varType, value, aux, ARM_TYPE.WIZARD);
  }

  override onCalcStat(general: any, statName: string, value: number, aux?: any): number {
    if (statName === 'warMagicSuccessProb') {
      return value + 0.2;
    }
    return applyCrewDexShare(general, statName, value, aux, ARM_TYPE.WIZARD);
  }
}

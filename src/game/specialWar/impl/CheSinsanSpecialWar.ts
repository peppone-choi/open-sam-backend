import { BaseSpecialWar } from '../BaseSpecialWar';

export class CheSinsanSpecialWar extends BaseSpecialWar {
  constructor() {
    super('che_신산', '신산', '[계략] 화계 등 성공률 +10%p / [전투] 계략 시도·성공 확률 +20%p');
  }

  override onCalcDomestic(turnType: string, varType: string, value: number): number {
    if (turnType === '계략' && varType === 'success') {
      return value + 0.1;
    }
    return value;
  }

  override onCalcStat(_general: any, statName: string, value: number): number {
    if (statName === 'warMagicTrialProb' || statName === 'warMagicSuccessProb') {
      return value + 0.2;
    }
    return value;
  }
}

import { BaseSpecialWar } from '../BaseSpecialWar';

export class CheSinjungSpecialWar extends BaseSpecialWar {
  constructor() {
    super('che_신중', '신중', '[전투] 계략 성공 확률 100%');
  }

  override onCalcStat(_general: any, statName: string, value: number): number {
    if (statName === 'warMagicSuccessProb') {
      return value + 1;
    }
    return value;
  }
}

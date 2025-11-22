import { BaseSpecialWar } from '../BaseSpecialWar';

export class CheHwansulSpecialWar extends BaseSpecialWar {
  constructor() {
    super('che_환술', '환술', '[전투] 계략 성공 확률 +10%p, 성공 시 대미지 +30%');
  }

  override onCalcStat(_general: any, statName: string, value: number): number {
    if (statName === 'warMagicSuccessProb') {
      return value + 0.1;
    }
    if (statName === 'warMagicSuccessDamage') {
      return value * 1.3;
    }
    return value;
  }
}

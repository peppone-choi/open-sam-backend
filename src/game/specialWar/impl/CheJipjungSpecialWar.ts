import { BaseSpecialWar } from '../BaseSpecialWar';

export class CheJipjungSpecialWar extends BaseSpecialWar {
  constructor() {
    super('che_집중', '집중', '[전투] 계략 성공 시 대미지 +50%');
  }

  override onCalcStat(_general: any, statName: string, value: number): number {
    if (statName === 'warMagicSuccessDamage') {
      return value * 1.5;
    }
    return value;
  }
}

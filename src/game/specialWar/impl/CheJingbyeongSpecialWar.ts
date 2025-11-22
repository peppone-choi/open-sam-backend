import { BaseSpecialWar } from '../BaseSpecialWar';

function getBaseLeadership(general: any): number {
  if (typeof general.getVar === 'function') {
    const value = general.getVar('leadership');
    if (typeof value === 'number') {
      return value;
    }
  }
  return general?.data?.leadership ?? 0;
}

export class CheJingbyeongSpecialWar extends BaseSpecialWar {
  constructor() {
    super('che_징병', '징병', '[군사] 징병/모병 시 훈련·사기 고정, 인구 보호 / [전투] 통솔 순수 능력치 25% 추가');
  }

  override onCalcDomestic(turnType: string, varType: string, value: number): number {
    if (['징병', '모병'].includes(turnType) && (varType === 'train' || varType === 'atmos')) {
      return turnType === '징병' ? 70 : 84;
    }
    if (turnType === '징집인구' && varType === 'score') {
      return 0;
    }
    return value;
  }

  override onCalcStat(general: any, statName: string, value: number): number {
    if (statName === 'leadership') {
      const base = getBaseLeadership(general);
      return value + base * 0.25;
    }
    return value;
  }
}

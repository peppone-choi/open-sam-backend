import { BaseSpecialWar } from '../BaseSpecialWar';

function getRankValue(general: any, key: string): number {
  if (typeof general.getRankVar === 'function') {
    return general.getRankVar(key, 0);
  }
  const rank = general.rank || {};
  const value = rank[key];
  return typeof value === 'number' ? value : 0;
}

export class CheMusangSpecialWar extends BaseSpecialWar {
  constructor() {
    super('che_무쌍', '무쌍', '[전투] 기본 대미지 +5%, 피해 -2%, 공격 시 필살 확률 +10%p, 승수에 따라 추가 보정');
  }

  override onCalcStat(general: any, statName: string, value: number, aux?: any): number {
    if (statName === 'warCriticalRatio' && aux?.isAttacker) {
      return value + 0.1;
    }
    return value;
  }

  override getWarPowerMultiplier(unit: any): [number, number] {
    const baseAttack = 1.05;
    const baseDefence = 0.98;
    const killnum = getRankValue(unit?.getGeneral?.(), 'killnum');
    const normalized = Math.max(1, killnum / 5);
    const logValue = Math.log(normalized) / Math.log(2);
    const bonus = logValue / 20;
    const defenceReduction = logValue / 50;
    return [baseAttack + bonus, baseDefence - defenceReduction];
  }
}

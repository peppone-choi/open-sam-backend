/**
 * 이벤트 무쌍 특기
 * PHP 대응: che_event_무쌍.php
 */

import { BaseSpecialDomestic } from '../../BaseSpecialDomestic';
import type { WarUnit } from '../../../../battle/WarUnit';

function getRankValue(general: any, key: string): number {
  if (typeof general?.getRankVar === 'function') {
    return general.getRankVar(key, 0);
  }
  const rank = general?.rank || {};
  return typeof rank[key] === 'number' ? rank[key] : 0;
}

export class CheEventMusangSpecialDomestic extends BaseSpecialDomestic {
  get id(): string {
    return 'che_event_무쌍';
  }

  getName(): string {
    return '무쌍';
  }

  getInfo(): string {
    return '[전투] 대미지 +5%, 피해 -2%, 필살 확률 +10%p, 승수 비례 보정';
  }

  override onCalcStat(_general: any, statName: string, value: number, aux?: any): number {
    if (statName === 'warCriticalRatio' && aux?.isAttacker) {
      return value + 0.1;
    }
    return value;
  }

  override getWarPowerMultiplier(unit: WarUnit): [number, number] {
    const baseAttack = 1.05;
    const baseDefence = 0.98;
    const killnum = getRankValue(unit?.getGeneral?.(), 'killnum');
    const normalized = Math.max(1, killnum / 5);
    const logValue = Math.log(normalized) / Math.log(2);
    return [baseAttack + logValue / 20, baseDefence - logValue / 50];
  }
}

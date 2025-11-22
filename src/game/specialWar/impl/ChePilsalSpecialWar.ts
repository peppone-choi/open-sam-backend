import type { WarUnit } from '../../../battle/WarUnit';
import { BaseSpecialWar } from '../BaseSpecialWar';
import { WarUnitTriggerCaller } from '../../triggers/WarUnitTriggerCaller';
import { ChePilsalNoEvasionTrigger } from '../../triggers/effects/ChePilsalNoEvasionTrigger';

export class ChePilsalSpecialWar extends BaseSpecialWar {
  constructor() {
    super('che_필살', '필살', '[전투] 필살 확률 +30%p, 필살 계수 향상');
  }

  override onCalcStat(_general: any, statName: string, value: number | [number, number], _aux?: any): any {
    if (statName === 'warCriticalRatio' && typeof value === 'number') {
      return value + 0.3;
    }

    if (statName === 'criticalDamageRange' && Array.isArray(value) && value.length === 2) {
      const [min, max] = value as [number, number];
      const adjustedMin = (min + max) / 2;
      return [adjustedMin, max] as [number, number];
    }
 
     return value;
   }
 
   override getBattlePhaseSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null {
     return new WarUnitTriggerCaller(new ChePilsalNoEvasionTrigger(unit));
   }
 }


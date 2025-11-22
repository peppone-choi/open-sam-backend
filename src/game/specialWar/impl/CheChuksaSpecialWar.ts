import type { WarUnit } from '../../../battle/WarUnit';
import { BaseSpecialWar } from '../BaseSpecialWar';

export class CheChuksaSpecialWar extends BaseSpecialWar {
  constructor() {
    super('che_척사', '척사', '[전투] 지역/도시 전용 병종 상대로 대미지 +20%, 피해 -20%');
  }

  override getWarPowerMultiplier(unit: WarUnit): [number, number] {
    const opposeCrew = unit.getOppose()?.getCrewType();
    if (!opposeCrew) {
      return [1, 1];
    }

    const hasRegionRequirement = Array.isArray(opposeCrew.reqRegions) && opposeCrew.reqRegions.length > 0;
    const hasCityRequirement = Array.isArray(opposeCrew.reqCities) && opposeCrew.reqCities.length > 0;

    if (hasRegionRequirement || hasCityRequirement) {
      return [1.2, 0.8];
    }

    return [1, 1];
  }
}

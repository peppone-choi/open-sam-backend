import type { GameUnitDetail } from '../../const/GameUnitConst';

function getGeneralData(general: any): Record<string, any> {
  if (!general) return {};
  if (typeof general.getRaw === 'function') {
    return general.getRaw();
  }
  return general.data || general;
}

export function getGeneralVar(general: any, key: string, fallback = 0): number {
  if (!general) return fallback;
  if (typeof general.getVar === 'function') {
    const value = general.getVar(key);
    if (value !== undefined) {
      return value;
    }
  }
  const data = getGeneralData(general);
  const value = data?.[key];
  return typeof value === 'number' ? value : fallback;
}

export function adjustRecruitCostByArmType(
  turnType: string,
  varType: string,
  value: number,
  aux: any,
  armType: number,
  multiplier = 0.9
): number {
  if (!['징병', '모병'].includes(turnType)) {
    return value;
  }
  if (varType !== 'cost') {
    return value;
  }
  if (aux?.armType !== armType) {
    return value;
  }
  return value * multiplier;
}

export function applyCrewDexShare(
  general: any,
  statName: string,
  value: number,
  aux: { isAttacker?: boolean; opposeType?: GameUnitDetail | null } | undefined,
  referenceArmType: number
): number {
  if (!statName.startsWith('dex')) {
    return value;
  }

  const dexKey = `dex${referenceArmType}`;
  const crewDex = getGeneralVar(general, dexKey, 0);
  if (!crewDex) {
    return value;
  }

  const isAttacker = !!aux?.isAttacker;
  const opposeArmType = aux?.opposeType?.armType;

  if (isAttacker && opposeArmType !== undefined && statName === `dex${opposeArmType}`) {
    return value + crewDex;
  }

  if (!isAttacker && statName === dexKey) {
    return value + crewDex;
  }

  return value;
}

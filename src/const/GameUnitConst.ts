/**
 * 병종 상수 정의
 * JSON 파일에서 로드 (시나리오 설정의 data.assets.units 경로 사용)
 */

import * as fs from 'fs';
import * as path from 'path';
import { getScenarioConstants, loadDataAsset, getDataAssetPath } from '../utils/scenario-data';

const scenarioConstants = getScenarioConstants();
const unitTypeConstants = scenarioConstants?.unitTypes ?? {};

export const ARM_TYPE = {
  CASTLE: 0,
  FOOTMAN: 1,
  ARCHER: 2,
  CAVALRY: 3,
  WIZARD: 4,
  SIEGE: 5,
  MISC: 6
} as const;

const TYPE_MAP: Record<string, number> = {
  'CASTLE': ARM_TYPE.CASTLE,
  'FOOTMAN': ARM_TYPE.FOOTMAN,
  'ARCHER': ARM_TYPE.ARCHER,
  'CAVALRY': ARM_TYPE.CAVALRY,
  'WIZARD': ARM_TYPE.WIZARD,
  'SIEGE': ARM_TYPE.SIEGE,
  'MISC': ARM_TYPE.MISC
};

export const ARM_TYPE_NAMES: Record<number, string> = {
  [ARM_TYPE.FOOTMAN]: '보병',
  [ARM_TYPE.ARCHER]: '궁병',
  [ARM_TYPE.CAVALRY]: '기병',
  [ARM_TYPE.WIZARD]: '귀병',
  [ARM_TYPE.SIEGE]: '차병',
};

export interface GameUnitDetail {
  id: number;
  armType: number;
  name: string;
  attack: number;
  defence: number;
  speed: number;
  avoid: number;
  critical?: number;
  magicCoef: number;
  cost: number;
  rice: number;
  reqTech: number;
  reqYear: number;
  reqRegions?: string[];
  reqCities?: string[];
  reqNationType?: string | string[]; // 국가 타입 제약 (reqNationType 또는 country_type_unlock)
  reqLeadership?: number; // 통솔력 요구
  reqStrength?: number; // 무력 요구
  reqIntel?: number; // 지력 요구
  reqOfficerLevel?: number; // 관직 레벨 요구
  impossible?: boolean; // 징병 불가
  maxCount?: number; // 최대 부대 수 제한
  timeRestriction?: string; // 시간 제한 (야간 전용 등)
  seasonRestriction?: string; // 계절 제한 (겨울 전용 등)
  weatherRestriction?: string; // 날씨 제한 (건조한 날씨 등)
  terrainRestriction?: string; // 지형 제한 (수전 전용 등)
  upkeepMultiplier?: number; // 유지비 배수 (용병 등)
  setupTime?: number; // 설치 시간 (공성병기 등)
  info: string[];
}

function createFallbackUnit(id: number): GameUnitDetail {
  return {
    id,
    armType: ARM_TYPE.FOOTMAN,
    name: `병종 ${id}`,
    attack: 100,
    defence: 100,
    speed: 7,
    avoid: 0,
    magicCoef: 0,
    cost: 1,
    rice: 100,
    reqTech: 0,
    reqYear: 0,
    info: []
  };
}

/**
 * JSON 파일에서 병종 데이터 로드
 * 시나리오 설정(scenario.json)의 data.assets.units 경로 사용
 */
// 시나리오별 캐시
const unitsDataCache: Map<string, any> = new Map();
const unitCacheByScenario: Map<string, Map<number, GameUnitDetail>> = new Map();
const typeCacheByScenario: Map<string, Map<number, GameUnitDetail[]>> = new Map();

function loadUnitsFromJSON(scenarioId: string = 'sangokushi'): any {
  // 캐시 확인
  if (unitsDataCache.has(scenarioId)) {
    return unitsDataCache.get(scenarioId);
  }

  // scenario.json의 data.assets.units 경로에서 로드 시도
  let unitsData = loadDataAsset(scenarioId, 'units');

  if (unitsData) {
    unitsDataCache.set(scenarioId, unitsData);
    return unitsData;
  }

  // fallback: 직접 경로에서 로드 (기존 방식)
  const projectRoot = path.resolve(__dirname, '../..');
  const candidates: string[] = [
    path.join(projectRoot, 'config', 'scenarios', scenarioId, 'data', 'units.json'),
    path.join(process.cwd(), 'config', 'scenarios', scenarioId, 'data', 'units.json'),
  ];

  for (const unitsPath of candidates) {
    try {
      if (fs.existsSync(unitsPath)) {
        const fileContent = fs.readFileSync(unitsPath, 'utf-8');
        unitsData = JSON.parse(fileContent);
        unitsDataCache.set(scenarioId, unitsData);
        return unitsData;
      }
    } catch (error) {
      console.error('Failed to load units.json from', unitsPath, error);
    }
  }

  // sangokushi fallback
  if (scenarioId !== 'sangokushi') {
    console.warn(`[GameUnitConst] units.json not found for ${scenarioId}, falling back to sangokushi`);
    return loadUnitsFromJSON('sangokushi');
  }

  console.error('units.json not found for scenario:', scenarioId);
  const emptyData = { units: {} };
  unitsDataCache.set(scenarioId, emptyData);
  return emptyData;
}

function buildUnitCache(scenarioId: string = 'sangokushi'): void {
  // 시나리오별 캐시 확인
  if (unitCacheByScenario.has(scenarioId) && typeCacheByScenario.has(scenarioId)) {
    return;
  }

  const unitCache = new Map<number, GameUnitDetail>();
  const typeCache = new Map<number, GameUnitDetail[]>();

  const data = loadUnitsFromJSON(scenarioId);
  const units = data.units || {};

  for (const [idStr, unitData] of Object.entries(units)) {
    const id = Number(idStr);
    // NaN ID 건너뛰기 (숫자가 아닌 키)
    if (!Number.isFinite(id)) {
      console.warn(`[GameUnitConst] Skipping unit with invalid ID: ${idStr}`);
      continue;
    }
    const unit = unitData as any;
    const armType = TYPE_MAP[unit.type] ?? ARM_TYPE.FOOTMAN;
    
    // constraints에서 요구사항 추출
    let reqTech = 0;
    let reqYear = 0;
    const reqRegions: string[] = [];
    const reqCities: string[] = [];

    let reqNationType: string | string[] | undefined;
    let reqLeadership: number | undefined;
    let reqStrength: number | undefined;
    let reqIntel: number | undefined;
    let reqOfficerLevel: number | undefined;
    let impossible: boolean | undefined;
    let maxCount: number | undefined;
    let timeRestriction: string | undefined;
    let seasonRestriction: string | undefined;
    let weatherRestriction: string | undefined;
    let terrainRestriction: string | undefined;
    let upkeepMultiplier: number | undefined;
    let setupTime: number | undefined;
    
    if (unit.constraints && Array.isArray(unit.constraints)) {
      for (const constraint of unit.constraints) {
        if (constraint.type === 'reqTech') {
          reqTech = constraint.value || 0;
        } else if (constraint.type === 'reqMinRelYear') {
          reqYear = constraint.value || 0;
        } else if (constraint.type === 'reqRegions') {
          if (Array.isArray(constraint.value)) {
            reqRegions.push(...constraint.value);
          } else if (constraint.value) {
            reqRegions.push(constraint.value);
          }
        } else if (constraint.type === 'reqCities') {
          if (Array.isArray(constraint.value)) {
            reqCities.push(...constraint.value);
          } else if (constraint.value) {
            reqCities.push(constraint.value);
          }
        } else if (constraint.type === 'country_type_unlock' || constraint.type === 'reqNationType') {
          // 국가 타입 제약 조건
          reqNationType = constraint.value || undefined;
        } else if (constraint.type === 'reqLeadership') {
          // 통솔력 요구
          reqLeadership = constraint.value || undefined;
        } else if (constraint.type === 'reqStrength') {
          // 무력 요구
          reqStrength = constraint.value || undefined;
        } else if (constraint.type === 'reqIntel') {
          // 지력 요구
          reqIntel = constraint.value || undefined;
        } else if (constraint.type === 'reqOfficerLevel') {
          // 관직 레벨 요구
          reqOfficerLevel = constraint.value || undefined;
        } else if (constraint.type === 'impossible') {
          // 징병 불가
          impossible = true;
        } else if (constraint.type === 'maxCount') {
          // 최대 부대 수 제한
          maxCount = constraint.value || undefined;
        } else if (constraint.type === 'timeRestriction') {
          // 시간 제한 (야간 전용 등)
          timeRestriction = constraint.value || undefined;
        } else if (constraint.type === 'seasonRestriction') {
          // 계절 제한 (겨울 전용 등)
          seasonRestriction = constraint.value || undefined;
        } else if (constraint.type === 'weatherRestriction') {
          // 날씨 제한 (건조한 날씨 등)
          weatherRestriction = constraint.value || undefined;
        } else if (constraint.type === 'terrainRestriction') {
          // 지형 제한 (수전 전용 등)
          terrainRestriction = constraint.value || undefined;
        } else if (constraint.type === 'upkeepMultiplier') {
          // 유지비 배수 (용병 등)
          upkeepMultiplier = constraint.value || undefined;
        } else if (constraint.type === 'setupTime') {
          // 설치 시간 (공성병기 등)
          setupTime = constraint.value || undefined;
        }
      }
    }

    // stats에서 능력치 추출
    const stats = unit.stats || {};
    const attack = stats.offense || 0;
    const defence = stats.defenseRange || stats.defense || 0;
    const speed = stats.attackRange || 7;
    const avoid = stats.avoid || 0;
    const magicCoef = stats.magic || 0;

    // cost에서 비용 추출
    const cost = unit.cost?.gold || 100;
    const rice = unit.cost?.rice || 100;

    const unitDetail: GameUnitDetail = {
      id,
      armType,
      name: unit.name || `병종 ${id}`,
      attack,
      defence,
      speed,
      avoid,
      magicCoef,
      cost,
      rice,
      reqTech,
      reqYear,
      reqRegions: reqRegions.length > 0 ? reqRegions : undefined,
      reqCities: reqCities.length > 0 ? reqCities : undefined,
      reqNationType,
      reqLeadership,
      reqStrength,
      reqIntel,
      reqOfficerLevel,
      impossible,
      maxCount,
      timeRestriction,
      seasonRestriction,
      weatherRestriction,
      terrainRestriction,
      upkeepMultiplier,
      setupTime,
      info: Array.isArray(unit.description) ? unit.description : [unit.description || '']
    };

    unitCache.set(id, unitDetail);

    if (!typeCache.has(armType)) {
      typeCache.set(armType, []);
    }
    typeCache.get(armType)!.push(unitDetail);
  }

  // 시나리오별 캐시에 저장
  unitCacheByScenario.set(scenarioId, unitCache);
  typeCacheByScenario.set(scenarioId, typeCache);
}

export function getAllUnitTypes(): Record<number, string> {
  return ARM_TYPE_NAMES;
}

export function getUnitByID(id: number, scenarioId: string = 'sangokushi'): GameUnitDetail | null {
  // NaN 또는 유효하지 않은 ID 체크
  if (!Number.isFinite(id)) {
    console.warn(`[GameUnitConst] getUnitByID called with invalid ID: ${id}`);
    return null;
  }
  buildUnitCache(scenarioId);
  const unitCache = unitCacheByScenario.get(scenarioId);
  return unitCache?.get(id) || null;
}

export const GameUnitConst = {
  byID: (id: number, scenarioId: string = 'sangokushi'): GameUnitDetail => {
    // NaN 또는 유효하지 않은 ID인 경우 기본 병종 반환
    if (!Number.isFinite(id)) {
      console.warn(`[GameUnitConst] byID called with invalid ID: ${id}, returning default unit`);
      return createFallbackUnit(1100); // 기본 병종 ID 사용
    }
    return getUnitByID(id, scenarioId) ?? createFallbackUnit(id);
  },
  allType: () => ARM_TYPE_NAMES,
  CREWTYPE_CASTLE: unitTypeConstants?.CREWTYPE_CASTLE ?? 1000,
  DEFAULT_CREWTYPE: unitTypeConstants?.DEFAULT_CREWTYPE ?? 1100,
};

export function getUnitsByType(armType: number, scenarioId: string = 'sangokushi'): GameUnitDetail[] {
  buildUnitCache(scenarioId);
  const typeCache = typeCacheByScenario.get(scenarioId);
  return typeCache?.get(armType) || [];
}

export function getAllUnits(scenarioId: string = 'sangokushi'): GameUnitDetail[] {
  buildUnitCache(scenarioId);
  const unitCache = unitCacheByScenario.get(scenarioId);
  return unitCache ? Array.from(unitCache.values()) : [];
}

/**
 * 병종 간 공격 상성 계수 가져오기
 * @param attackerUnitId 공격자 병종 ID
 * @param defenderType 방어자 병종 타입 (FOOTMAN, SPEARMAN, CAVALRY, ARCHER 등)
 * @returns 상성 계수 (1.0 = 대등, >1.0 = 유리, <1.0 = 불리)
 */
export function getAttackAdvantage(attackerUnitId: number, defenderType: string, scenarioId: string = 'sangokushi'): number {
  buildUnitCache(scenarioId);
  const unitCache = unitCacheByScenario.get(scenarioId);
  const attacker = unitCache?.get(attackerUnitId);
  
  if (!attacker) return 1.0;
  
  // units.json의 attacks 데이터에서 상성 가져오기
  const data = loadUnitsFromJSON(scenarioId);
  const unitData = data.units?.[attackerUnitId.toString()];
  
  if (!unitData || !unitData.attacks) return 1.0;
  
  return unitData.attacks[defenderType] || 1.0;
}

/**
 * 병종 간 방어 상성 계수 가져오기
 * @param defenderUnitId 방어자 병종 ID
 * @param attackerType 공격자 병종 타입
 * @returns 방어 계수 (>1.0 = 피해 증가, <1.0 = 피해 감소)
 */
export function getDefenseAdvantage(defenderUnitId: number, attackerType: string, scenarioId: string = 'sangokushi'): number {
  buildUnitCache(scenarioId);
  const unitCache = unitCacheByScenario.get(scenarioId);
  const defender = unitCache?.get(defenderUnitId);
  
  if (!defender) return 1.0;
  
  const data = loadUnitsFromJSON(scenarioId);
  const unitData = data.units?.[defenderUnitId.toString()];
  
  if (!unitData || !unitData.defenses) return 1.0;
  
  return unitData.defenses[attackerType] || 1.0;
}

/**
 * 병종이 사용 가능한지 검증
 */
export interface UnitAvailabilityContext {
  tech: number;
  relYear: number;
  ownCities?: number[];
  ownRegions?: string[];
  ownCityNames?: string[];
  nationType?: string;
  leadership?: number;
  strength?: number;
  intel?: number;
  officerLevel?: number;
}

export function isUnitAvailable(
  unit: GameUnitDetail,
  tech: number,
  relYear: number,
  ownCities?: number[],
  ownRegions?: string[],
  ownCityNames?: string[],
  nationType?: string,
  context?: Partial<UnitAvailabilityContext>
): boolean {
  // 징병 불가 병종
  if (unit.impossible) {
    return false;
  }

  // 기술력 검증
  if (unit.reqTech > 0 && tech < unit.reqTech) {
    return false;
  }

  // 연도 검증
  if (unit.reqYear > 0 && relYear < unit.reqYear) {
    return false;
  }

  // 지역 검증
  if (unit.reqRegions && unit.reqRegions.length > 0) {
    if (!ownRegions || !unit.reqRegions.some(r => ownRegions.includes(r))) {
      return false;
    }
  }

  // 도시 이름 검증
  if (unit.reqCities && unit.reqCities.length > 0) {
    if (!ownCityNames || !unit.reqCities.some(cityName => ownCityNames.includes(cityName))) {
      return false;
    }
  }

  // 국가 타입 제약 검증
  if (unit.reqNationType) {
    const reqTypes = Array.isArray(unit.reqNationType) ? unit.reqNationType : [unit.reqNationType];
    const normalizedNationType = nationType?.replace(/^che_/, '') || '';
    
    const hasMatchingType = reqTypes.some(reqType => {
      const normalizedReqType = reqType.replace(/^che_/, '');
      return normalizedNationType === normalizedReqType;
    });
    
    if (!hasMatchingType) {
      return false;
    }
  }

  // 통솔력 검증
  if (unit.reqLeadership && unit.reqLeadership > 0) {
    const leadership = context?.leadership ?? 0;
    if (leadership < unit.reqLeadership) {
      return false;
    }
  }

  // 무력 검증
  if (unit.reqStrength && unit.reqStrength > 0) {
    const strength = context?.strength ?? 0;
    if (strength < unit.reqStrength) {
      return false;
    }
  }

  // 지력 검증
  if (unit.reqIntel && unit.reqIntel > 0) {
    const intel = context?.intel ?? 0;
    if (intel < unit.reqIntel) {
      return false;
    }
  }

  // 관직 레벨 검증
  if (unit.reqOfficerLevel && unit.reqOfficerLevel > 0) {
    const officerLevel = context?.officerLevel ?? 0;
    if (officerLevel < unit.reqOfficerLevel) {
      return false;
    }
  }

  return true;
}


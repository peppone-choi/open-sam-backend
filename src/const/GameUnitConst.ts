/**
 * 병종 상수 정의
 * JSON 파일에서 로드
 */

import * as fs from 'fs';
import * as path from 'path';

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
  magicCoef: number;
  cost: number;
  rice: number;
  reqTech: number;
  reqYear: number;
  reqRegions?: string[];
  reqCities?: string[];
  reqNationType?: string; // 국가 타입 제약 (country_type_unlock)
  info: string[];
}

/**
 * JSON 파일에서 병종 데이터 로드
 */
let unitCache: Map<number, GameUnitDetail> | null = null;
let typeCache: Map<number, GameUnitDetail[]> | null = null;
let unitsData: any = null;

function loadUnitsFromJSON(scenarioId: string = 'sangokushi'): any {
  if (unitsData) return unitsData;

  try {
    const configDir = path.join(process.cwd(), 'config', 'scenarios', scenarioId, 'data');
    const unitsPath = path.join(configDir, 'units.json');
    
    if (fs.existsSync(unitsPath)) {
      const fileContent = fs.readFileSync(unitsPath, 'utf-8');
      unitsData = JSON.parse(fileContent);
      return unitsData;
    }
  } catch (error) {
    console.error('Failed to load units.json:', error);
  }

  return { units: {} };
}

function buildUnitCache(scenarioId: string = 'sangokushi'): void {
  if (unitCache && typeCache) return;

  unitCache = new Map();
  typeCache = new Map();

  const data = loadUnitsFromJSON(scenarioId);
  const units = data.units || {};

  for (const [idStr, unitData] of Object.entries(units)) {
    const id = Number(idStr);
    const unit = unitData as any;
    const armType = TYPE_MAP[unit.type] ?? ARM_TYPE.FOOTMAN;
    
    // constraints에서 요구사항 추출
    let reqTech = 0;
    let reqYear = 0;
    const reqRegions: string[] = [];
    const reqCities: string[] = [];

    let reqNationType: string | undefined;
    
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
        } else if (constraint.type === 'country_type_unlock') {
          // 국가 타입 제약 조건
          reqNationType = constraint.value || undefined;
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
      info: Array.isArray(unit.description) ? unit.description : [unit.description || '']
    };

    unitCache.set(id, unitDetail);

    if (!typeCache.has(armType)) {
      typeCache.set(armType, []);
    }
    typeCache.get(armType)!.push(unitDetail);
  }
}

export function getAllUnitTypes(): Record<number, string> {
  return ARM_TYPE_NAMES;
}

export function getUnitByID(id: number, scenarioId: string = 'sangokushi'): GameUnitDetail | null {
  buildUnitCache(scenarioId);
  return unitCache!.get(id) || null;
}

export function getUnitsByType(armType: number, scenarioId: string = 'sangokushi'): GameUnitDetail[] {
  buildUnitCache(scenarioId);
  return typeCache!.get(armType) || [];
}

export function getAllUnits(scenarioId: string = 'sangokushi'): GameUnitDetail[] {
  buildUnitCache(scenarioId);
  return Array.from(unitCache!.values());
}

/**
 * 병종이 사용 가능한지 검증
 */
export function isUnitAvailable(
  unit: GameUnitDetail,
  tech: number,
  relYear: number,
  ownCities?: number[],
  ownRegions?: string[],
  ownCityNames?: string[],
  nationType?: string
): boolean {
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
  if (unit.reqCities && unit.reqCities.length > 0 && ownCityNames) {
    if (!unit.reqCities.some(cityName => ownCityNames.includes(cityName))) {
      return false;
    }
  }

  // 국가 타입 제약 검증
  if (unit.reqNationType) {
    if (!nationType || nationType !== unit.reqNationType) {
      // 국가 타입 ID 정규화 (che_ 접두사 제거)
      const normalizedNationType = nationType?.replace(/^che_/, '') || '';
      const normalizedReqType = unit.reqNationType.replace(/^che_/, '');
      
      if (normalizedNationType !== normalizedReqType) {
        return false;
      }
    }
  }

  return true;
}


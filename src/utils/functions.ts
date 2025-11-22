// @ts-nocheck - Type issues need investigation
export function getDexLevelList(level: number): any[] {
  return [];
}

// tryUniqueItemLottery와 giveRandomUniqueItem은 unique-item-lottery.ts로 이동
export { tryUniqueItemLottery, giveRandomUniqueItem } from './unique-item-lottery';
export { buildItemClass } from './item-class';

/**
 * 명예의 전당 체크
 */
export async function CheckHall(hallType: string, targetValue: number, currentValue: number): Promise<boolean> {
  // 명예의 전당 조건 체크
  return currentValue >= targetValue;
}

/**
 * 관직 레벨 조회
 */
export function checkOfficerLevel(officerLevel: number): number {
  // 관직 레벨 유효성 체크
  if (officerLevel < 0) return 0;
  if (officerLevel > 12) return 12;
  return officerLevel;
}

/**
 * 국가 타입 조회
 */
export function getNationType(type: string | number): string {
  const typeMap: Record<string | number, string> = {
    0: 'None',
    1: 'Wandering',
    2: 'Normal',
    3: 'Special',
    'None': 'None',
    'Wandering': 'Wandering',
    'Normal': 'Normal',
    'Special': 'Special'
  };
  
  return typeMap[type] || 'Normal';
}

import { calculateDistanceList } from './cityDistance';
import { cityRepository } from '../repositories/city.repository';
import { nationRepository } from '../repositories/nation.repository';

/**
 * 도시 거리 검색
 */
export async function searchDistance(
  cityId: number, 
  range: number, 
  onlyOccupied: boolean,
  sessionId?: string
): Promise<Record<number, number>> {
  const query: any = {};
  if (sessionId) {
    query.session_id = sessionId;
  }

  let cities: any[] | null = null;
  if (sessionId) {
    cities = await cityRepository.findBySession(sessionId);
  } else {
    cities = await cityRepository.findByFilter(query);
  }
  cities = cities || [];
  
  // 도시 경로 정보 구성
  const cityConst: Record<number, { path?: Record<number, string> }> = {};
  for (const city of cities) {
    cityConst[city.city] = {
      path: city.data?.path || {}
    };
  }

  // 거리 목록 계산
  const distanceList = calculateDistanceList(cityId, cityConst, range);
  
  // 결과를 { cityId: distance } 형태로 변환
  const result: Record<number, number> = {};
  for (const [distance, cityList] of Object.entries(distanceList)) {
    const dist = parseInt(distance, 10);
    for (const cId of cityList) {
      result[cId] = dist;
    }
  }

  // onlyOccupied인 경우 점령된 도시만 필터링
  if (onlyOccupied) {
    const occupiedCities = cities.filter((c: any) => c.data?.nation > 0);
    const occupiedCityIds = new Set(occupiedCities.map((c: any) => c.city));
    
    for (const cId in result) {
      if (!occupiedCityIds.has(parseInt(cId, 10))) {
        delete result[cId];
      }
    }
  }

  return result;
}

/**
 * 가상 전투력 계산
 */
export function getVirtualPower(
  leadership: number,
  strength: number,
  intel: number,
  crew: number,
  crewType: number
): number {
  // 기본 능력치 합계
  const statTotal = leadership + strength + intel;
  
  // 병사 수와 병종에 따른 보정
  const crewPower = crew * (crewType / 1000);
  
  // 가상 전투력 = (능력치 합계 * 10) + (병사 전투력)
  return Math.floor(statTotal * 10 + crewPower);
}

// 국가 정적 정보 캐시 (PHP의 static $nationList와 동일한 역할)
let nationListCache: Record<string, Record<number, any>> = {};

/**
 * 국가의 정적 정보 조회 (PHP func.php의 getNationStaticInfo)
 * nationID가 0이면 재야 정보 반환
 * -1이면 전체 국가 목록 반환
 * 캐싱을 통해 성능 최적화
 */
export async function getNationStaticInfo(
  nationID: number | null,
  forceRefresh: boolean = false,
  sessionId?: string
): Promise<any> {
  if (nationID === null) {
    return null;
  }
  
  // 재야 (nation 0) - 항상 동일한 값 반환
  if (nationID === 0) {
    return {
      nation: 0,
      name: '재야',
      color: '#000000',
      type: 'None',
      level: 0,
      capital: 0,  // 재야는 수도 없음
      gold: 0,
      rice: 2000,
      tech: 0,
      gennum: 1,
      power: 1
    };
  }
  
  const cacheKey = sessionId || 'sangokushi_default';
  if (forceRefresh) {
    delete nationListCache[cacheKey];
  }
  
  // 전체 목록 요청 (-1) 또는 캐시가 없을 때 전체 목록 로드
  if (nationID === -1 || !nationListCache[cacheKey]) {
    const nations = (await nationRepository.findBySession(cacheKey)) || [];
    const map: Record<number, any> = {};
    nations.forEach((nation: any) => {
      map[nation.nation] = {
        nation: nation.nation,
        name: nation.name,
        color: nation.color,
        type: nation.type,
        level: nation.level,
        capital: nation.capital,
        gennum: nation.gennum,
        power: nation.power
      };
    });
    nationListCache[cacheKey] = map;
  }
  
  if (nationID === -1) {
    return nationListCache[cacheKey];
  }
  
  const sessionCache = nationListCache[cacheKey] || {};
  if (sessionCache[nationID]) {
    return sessionCache[nationID];
  }
  
  const nationDoc = await nationRepository.findByNationNum(cacheKey, nationID);
  if (!nationDoc) {
    return null;
  }
  const nation = typeof (nationDoc as any).toObject === 'function' ? (nationDoc as any).toObject() : nationDoc;
  const nationData = {
    nation: nation.nation,
    name: nation.name,
    color: nation.color,
    type: nation.type,
    level: nation.level,
    capital: nation.capital,
    gennum: nation.gennum,
    power: nation.power
  };
  
  sessionCache[nationID] = nationData;
  nationListCache[cacheKey] = sessionCache;
  return nationData;
}

/**
 * getNationStaticInfo() 함수의 국가 캐시를 초기화
 * PHP func.php의 refreshNationStaticInfo()와 동일한 역할
 */
export function refreshNationStaticInfo(): void {
  nationListCache = {};
}


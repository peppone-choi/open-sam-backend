export function getDexLevelList(level: number): any[] {
  return [];
}

// tryUniqueItemLottery와 giveRandomUniqueItem은 unique-item-lottery.ts로 이동
export { tryUniqueItemLottery, giveRandomUniqueItem } from './unique-item-lottery';

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

import { City } from '../models/city.model';
import { calculateDistanceList } from './cityDistance';

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

  // 모든 도시 조회
  const cities = await (City as any).find(query).select('city data').lean();
  
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

import { Nation } from '../models';

// 국가 정적 정보 캐시 (PHP의 static $nationList와 동일한 역할)
let nationListCache: Record<number, any> | null = null;

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
  
  // 캐시 초기화가 필요한 경우
  if (forceRefresh) {
    nationListCache = null;
  }
  
  // 전체 목록 요청 (-1) 또는 캐시가 없을 때 전체 목록 로드
  if (nationID === -1 || nationListCache === null) {
    const query: any = {};
    if (sessionId) {
      query.session_id = sessionId;
    }
    
    const nations = await (Nation as any)
      .find(query)
      .select('nation name color type level capital gennum power session_id')
      .lean();
    
    nationListCache = {};
    nations.forEach((nation: any) => {
      // session_id가 있으면 필터링에 사용
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
      
      // session_id별로 캐싱할 수도 있지만, 일단 전체 캐시로 처리
      nationListCache![nation.nation] = nationData;
    });
  }
  
  // 전체 목록 반환
  if (nationID === -1) {
    return nationListCache;
  }
  
  // 개별 국가 조회
  if (nationListCache && nationListCache[nationID]) {
    return nationListCache[nationID];
  }
  
  // 캐시에 없으면 DB에서 직접 조회 (새로 생성된 국가일 수 있음)
  const query: any = { nation: nationID };
  if (sessionId) {
    query.session_id = sessionId;
  }
  
  const nation = await (Nation as any).findOne(query).select('nation name color type level capital gennum power').lean();
  if (!nation) {
    return null;
  }
  
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
  
  // 캐시에 추가
  if (nationListCache) {
    nationListCache[nationID] = nationData;
  }
  
  return nationData;
}

/**
 * getNationStaticInfo() 함수의 국가 캐시를 초기화
 * PHP func.php의 refreshNationStaticInfo()와 동일한 역할
 */
export function refreshNationStaticInfo(): void {
  nationListCache = null;
}

/**
 * 아이템 클래스 빌드
 */
export function buildItemClass(itemId: number, itemData?: any): any {
  return {
    id: itemId,
    ...itemData,
    getEffect: function() {
      return this.effect || {};
    },
    getName: function() {
      return this.name || `Item ${this.id}`;
    }
  };
}

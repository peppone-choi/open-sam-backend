export function getDexLevelList(level: number): any[] {
  return [];
}

export function tryUniqueItemLottery(...args: any[]): any {
  return null;
}

export function CheckHall(...args: any[]): any {
  return null;
}

export function checkOfficerLevel(...args: any[]): any {
  return 0;
}

export function getNationType(...args: any[]): any {
  return 0;
}

export async function searchDistance(cityId: number, range: number, onlyOccupied: boolean): Promise<Record<number, number>> {
  return {};
}

export function getVirtualPower(...args: any[]): number {
  return 0;
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

export function buildItemClass(...args: any[]): any {
  return null;
}

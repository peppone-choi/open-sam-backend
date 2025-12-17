import { cityRepository } from '../repositories/city.repository';
import { logger } from '../common/logger';
import { CityConst } from '../const/CityConst';

/**
 * 도시 연결 정보 캐시
 * sessionId => { cityID => neighbors[] }
 */
const cityGraphCache: Map<string, Map<number, number[]>> = new Map();

/**
 * 캐시 초기화 여부
 */
let cacheInitialized = false;

/**
 * 특정 세션의 도시 연결 정보를 메모리에 로드
 * MongoDB의 neighbors 필드가 비어있을 경우 CityConst (cities.json)에서 로드
 * @param sessionId 세션 ID
 */
export async function loadCityGraph(sessionId: string): Promise<void> {
  try {
    // 먼저 CityConst (cities.json)에서 도시 연결 정보 로드
    const cityConstList = CityConst.getCityList();
    const graph = new Map<number, number[]>();
    
    // CityConst에서 neighbors 정보 로드
    for (const cityEntry of cityConstList) {
      const cityID = cityEntry.city;
      if (!cityID) continue;
      
      const neighbors = cityEntry.neighbors || [];
      if (neighbors.length > 0) {
        graph.set(cityID, neighbors);
      }
    }
    
    // CityConst에 neighbors가 없으면 MongoDB에서 로드 시도
    if (graph.size === 0) {
      const cities = await cityRepository.findByFilter({ session_id: sessionId });

      for (const city of cities) {
        const cityID = city.city || city.data?.city;
        if (!cityID) continue;

        const neighbors = city.neighbors || city.data?.neighbors || [];
        const neighborIDs: number[] = [];

        for (const neighbor of neighbors) {
          const nID = typeof neighbor === 'number' ? neighbor : parseInt(String(neighbor), 10);
          if (!isNaN(nID)) {
            neighborIDs.push(nID);
          }
        }

        if (neighborIDs.length > 0) {
          graph.set(cityID, neighborIDs);
        }
      }
    }

    cityGraphCache.set(sessionId, graph);
    logger.info('Loaded city graph', { sessionId, cityCount: graph.size, source: graph.size > 0 ? 'CityConst/MongoDB' : 'empty' });
  } catch (error: any) {
    logger.error('Failed to load city graph', { 
      sessionId, 
      error: error.message 
    });
  }
}

/**
 * 모든 세션의 도시 연결 정보를 로드
 */
export async function initializeCityGraphCache(): Promise<void> {
  if (cacheInitialized) return;

  try {
    // 기본 세션 로드
    await loadCityGraph('sangokushi_default');
    cacheInitialized = true;
    logger.info('City graph cache initialized');
  } catch (error: any) {
    logger.error('Failed to initialize city graph cache', { error: error.message });
  }
}

/**
 * 캐시 클리어
 */
export function clearCityGraphCache(sessionId?: string): void {
  if (sessionId) {
    cityGraphCache.delete(sessionId);
    logger.debug('Cleared city graph cache for session', { sessionId });
  } else {
    cityGraphCache.clear();
    cacheInitialized = false;
    logger.debug('Cleared all city graph cache');
  }
}

/**
 * BFS를 사용하여 시작 도시로부터 일정 거리 내의 도시들을 찾습니다
 * @param startCityID 시작 도시 ID
 * @param maxDistance 최대 거리
 * @param includeStart 시작 도시를 결과에 포함할지 여부
 * @param sessionId 세션 ID (옵션, 기본값: 'sangokushi_default')
 * @returns 도시ID => 거리 매핑 객체
 */
export function searchDistance(
  startCityID: number,
  maxDistance: number,
  includeStart: boolean = false,
  sessionId: string = 'sangokushi_default'
): Record<number, number> {
  const distances: Record<number, number> = {};

  if (!startCityID || maxDistance < 1) {
    return distances;
  }

  // 캐시된 그래프 가져오기
  const graph = cityGraphCache.get(sessionId);
  if (!graph) {
    logger.warn('No cached city graph for session', { sessionId });
    return distances;
  }

  // BFS로 거리 계산
  const visited = new Set<number>();
  const queue: Array<{ cityID: number; distance: number }> = [];

  queue.push({ cityID: startCityID, distance: 0 });
  visited.add(startCityID);

  if (includeStart) {
    distances[startCityID] = 0;
  }

  while (queue.length > 0) {
    const current = queue.shift()!;

    // 최대 거리 도달 시 건너뛰기
    if (current.distance >= maxDistance) {
      continue;
    }

    // 인접 도시들 탐색
    const neighbors = graph.get(current.cityID) || [];
    for (const neighborID of neighbors) {
      if (visited.has(neighborID)) {
        continue;
      }

      visited.add(neighborID);
      const nextDistance = current.distance + 1;
      distances[neighborID] = nextDistance;
      queue.push({ cityID: neighborID, distance: nextDistance });
    }
  }

  return distances;
}

/**
 * 비동기 버전의 searchDistance (캐시 없을 때 자동 로드)
 * @param sessionId 세션 ID
 * @param startCityID 시작 도시 ID  
 * @param maxDistance 최대 거리
 * @param includeStart 시작 도시를 결과에 포함할지 여부
 * @returns 도시ID => 거리 매핑 객체
 */
export async function searchDistanceAsync(
  sessionId: string,
  startCityID: number,
  maxDistance: number,
  includeStart: boolean = false
): Promise<Record<number, number>> {
  // 캐시가 없으면 로드
  if (!cityGraphCache.has(sessionId)) {
    await loadCityGraph(sessionId);
  }

  // 동기 함수 호출
  return searchDistance(startCityID, maxDistance, includeStart, sessionId);
}

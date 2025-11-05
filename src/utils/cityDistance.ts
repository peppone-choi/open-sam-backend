/**
 * 도시 간 거리 계산 유틸리티
 * PHP: JSCitiesBasedOnDistance 함수와 동일한 역할
 */

/**
 * 현재 도시 기준으로 거리별 도시 목록 계산
 * @param cityID 현재 도시 ID
 * @param cityConst 도시 상수 정보 (path 정보 포함)
 * @param maxDistance 최대 거리
 * @returns 거리별 도시 목록 { distance: [cityID, ...] }
 */
export function calculateDistanceList(
  cityID: number,
  cityConst: Record<number, { path?: Record<number, string> }>,
  maxDistance: number = 10
): Record<number, number[]> {
  const distanceList: Record<number, number[]> = {};
  const visited: Record<number, number> = {};
  const queue: Array<[number, number]> = [[cityID, 0]]; // [cityID, distance]

  while (queue.length > 0) {
    const [currentCityID, dist] = queue.shift()!;

    if (visited[currentCityID] !== undefined) {
      continue;
    }

    visited[currentCityID] = dist;

    if (dist > 0) {
      if (!distanceList[dist]) {
        distanceList[dist] = [];
      }
      distanceList[dist].push(currentCityID);
    }

    if (dist >= maxDistance) {
      continue;
    }

    // 인접 도시 찾기
    const cityInfo = cityConst[currentCityID];
    if (cityInfo && cityInfo.path) {
      for (const adjacentCityID of Object.keys(cityInfo.path).map(Number)) {
        if (visited[adjacentCityID] === undefined) {
          queue.push([adjacentCityID, dist + 1]);
        }
      }
    }
  }

  return distanceList;
}


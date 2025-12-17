// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { Nation } from '../../../models/nation.model';
import { General } from '../../../models/general.model';
import { City } from '../../../models/city.model';
import { ActionLogger } from '../../../types/ActionLogger';
import { Util } from '../../../utils/Util';
import { saveCity, saveGeneral } from '../../../common/cache/model-cache.helper';
import { createLogger } from '../../../utils/logger';
import { getScenarioConfig, loadDataAsset } from '../../../utils/scenario-data';

const logger = createLogger('UpdateCitySupply');

interface CitySupplyInfo {
  id: number;
  nation: number;
  supply: boolean;
}

/**
 * 도시 보급선 업데이트 액션
 * - 수도에서 BFS로 연결된 도시 탐색
 * - 보급이 끊긴 도시 페널티 적용
 * - 민심 30 이하 미보급 도시는 공백지로 전환
 */
export class UpdateCitySupply extends Action {
  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 184;
    const month = env['month'] || 1;
    const scenarioId = env['scenario_id'] || 'sangokushi';

    logger.info('[UpdateCitySupply] 보급선 업데이트 시작', { sessionId, year, month });

    // 1. 맵 데이터 로드 (도시 연결 정보)
    const mapData = await this.loadMapData(scenarioId);
    if (!mapData) {
      logger.warn('[UpdateCitySupply] 맵 데이터를 찾을 수 없습니다');
      return [UpdateCitySupply.name, 0];
    }

    // 2. 도시 및 국가 정보 로드
    const cities = await City.find({ session_id: sessionId });
    const nations = await Nation.find({ session_id: sessionId, 'data.level': { $gt: 0 } });

    // 3. 도시 보급 정보 구성
    const citySupplyMap: Map<number, CitySupplyInfo> = new Map();
    for (const city of cities) {
      if (city.nation !== 0) {
        citySupplyMap.set(city.city, {
          id: city.city,
          nation: city.nation || 0,
          supply: false
        });
      }
    }

    // 4. 각 국가의 수도에서 BFS로 보급선 탐색
    const queue: CitySupplyInfo[] = [];

    for (const nation of nations) {
      const capitalId = nation.data?.capital || 0;
      if (!capitalId || !citySupplyMap.has(capitalId)) continue;

      const capitalInfo = citySupplyMap.get(capitalId)!;
      if (capitalInfo.nation !== nation.nation) continue;

      capitalInfo.supply = true;
      queue.push(capitalInfo);
    }

    // BFS 탐색
    while (queue.length > 0) {
      const current = queue.shift()!;
      const cityMapData = mapData.cities?.find((c: any) => c.id === current.id);
      if (!cityMapData?.connections) continue;

      for (const connCityId of cityMapData.connections) {
        if (!citySupplyMap.has(connCityId)) continue;

        const connCity = citySupplyMap.get(connCityId)!;
        if (connCity.nation !== current.nation) continue;
        if (connCity.supply) continue;

        connCity.supply = true;
        queue.push(connCity);
      }
    }

    // 5. 보급 상태 업데이트
    // 공백지는 보급 상태 1
    await City.updateMany(
      { session_id: sessionId, nation: 0 },
      { $set: { supply: 1 } }
    );

    // 소속 도시는 먼저 0으로 초기화
    await City.updateMany(
      { session_id: sessionId, nation: { $ne: 0 } },
      { $set: { supply: 0 } }
    );

    // 보급 가능한 도시 업데이트
    const suppliedCityIds: number[] = [];
    for (const [cityId, info] of citySupplyMap) {
      if (info.supply) {
        suppliedCityIds.push(cityId);
      }
    }

    if (suppliedCityIds.length > 0) {
      await City.updateMany(
        { session_id: sessionId, city: { $in: suppliedCityIds } },
        { $set: { supply: 1 } }
      );
    }

    // 6. 미보급 도시 페널티 적용
    const unsuppliedCities = await City.find({
      session_id: sessionId,
      supply: 0,
      nation: { $ne: 0 }
    });

    const lostCities: any[] = [];
    const actionLogger = new ActionLogger(0, 0, year, month, sessionId);

    for (const city of unsuppliedCities) {
      // 내정 10% 감소
      city.pop = Math.floor((city.pop || 0) * 0.9);
      city.trust = Math.floor((city.trust || 50) * 0.9);
      city.agri = Math.floor((city.agri || 0) * 0.9);
      city.comm = Math.floor((city.comm || 0) * 0.9);
      city.secu = Math.floor((city.secu || 0) * 0.9);
      city.def = Math.floor((city.def || 0) * 0.9);
      city.wall = Math.floor((city.wall || 0) * 0.9);

      await saveCity(sessionId, city.city, city.toObject());

      // 해당 도시 장수들 병/훈/사 5% 감소
      const cityGenerals = await General.find({
        session_id: sessionId,
        $or: [
          { city: city.city },
          { 'data.city': city.city }
        ],
        nation: city.nation
      });

      for (const general of cityGenerals) {
        general.data.crew = Math.floor((general.data?.crew || 0) * 0.95);
        general.data.train = Math.floor((general.data?.train || 0) * 0.95);
        general.data.atmos = Math.floor((general.data?.atmos || 0) * 0.95);
        await saveGeneral(sessionId, general.no || general.data?.no, general.toObject());
      }

      // 민심 30 이하면 공백지 전환 대상
      if ((city.trust || 50) < 30) {
        lostCities.push(city);
      }
    }

    // 7. 민심 30 이하 미보급 도시 공백지 전환
    if (lostCities.length > 0) {
      const lostCityIds = lostCities.map(c => c.city);

      // 해당 도시의 태수/군수 해임
      await General.updateMany(
        { session_id: sessionId, 'data.officer_city': { $in: lostCityIds } },
        { $set: { 'data.officer_level': 1, 'data.officer_city': 0 } }
      );

      // 공백지로 전환
      await City.updateMany(
        { session_id: sessionId, city: { $in: lostCityIds } },
        {
          $set: {
            nation: 0,
            officer_set: 0,
            conflict: '{}',
            term: 0,
            front: 0,
            supply: 1
          }
        }
      );

      // 히스토리 로그
      for (const city of lostCities) {
        const cityName = city.name || `도시 ${city.city}`;
        actionLogger.pushGlobalHistoryLog(
          `<R><b>【고립】</b></><G><b>${cityName}</b></>이 보급이 끊겨 <R>미지배</> 도시가 되었습니다.`
        );
      }
    }

    await actionLogger.flush();

    logger.info('[UpdateCitySupply] 보급선 업데이트 완료', {
      sessionId,
      suppliedCities: suppliedCityIds.length,
      unsuppliedCities: unsuppliedCities.length,
      lostCities: lostCities.length
    });

    return [UpdateCitySupply.name, lostCities.length];
  }

  /**
   * 맵 데이터 로드
   */
  private async loadMapData(scenarioId: string): Promise<any> {
    try {
      // 시나리오별 맵 데이터 로드
      const mapData = await loadDataAsset(scenarioId, 'map.json');
      return mapData;
    } catch (error) {
      // 기본 삼국지 맵 데이터 시도
      try {
        const defaultMap = await loadDataAsset('sangokushi', 'map.json');
        return defaultMap;
      } catch {
        logger.warn('[UpdateCitySupply] 맵 데이터 로드 실패');
        return null;
      }
    }
  }
}



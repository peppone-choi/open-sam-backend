// @ts-nocheck - Type issues with Mongoose models
import { Action } from '../Action';
import { City } from '../../../models/city.model';
import { ActionLogger } from '../../../types/ActionLogger';
import { saveCity } from '../../../common/cache/model-cache.helper';

/**
 * 풍년 이벤트
 * 특정 확률로 도시에 풍년 발생 - 농업/인구 보너스
 */
export class BountifulHarvest extends Action {
  private chance: number;

  constructor(chance: number = 0.08) { // 기본 8% 확률
    super();
    this.chance = chance;
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const startYear = env['startyear'] || 184;
    const year = env['year'] || 184;
    const month = env['month'] || 1;

    // PHP와 동일: 분기별(4, 7월)에만 호황/풍작 발생
    // 4월: 호황 (state 2), 7월: 풍작 (state 1)
    if (![4, 7].includes(month)) {
      return { action: 'BountifulHarvest', affectedCities: [], count: 0, skipped: 'not_quarter' };
    }

    // PHP와 동일: 초반 3년은 스킵
    if (startYear + 3 > year) {
      return { action: 'BountifulHarvest', affectedCities: [], count: 0, skipped: 'early_years' };
    }

    // PHP와 동일: 호황(4월) vs 풍작(7월)
    const isHarvest = month === 7;
    const stateCode = isHarvest ? 1 : 2; // 1: 풍작, 2: 호황
    const eventName = isHarvest ? '풍작' : '호황';
    const eventIcon = isHarvest ? '🌾' : '💰';
    const eventMessage = isHarvest 
      ? '풍작으로 도시가 번창하고 있습니다.'
      : '호황으로 도시가 번창하고 있습니다.';

    const cities = await City.find({ session_id: sessionId });
    const affectedCities: string[] = [];

    for (const city of cities) {
      // PHP와 동일: secu(치안) 기반 확률 계산 (치안 높으면 호황 확률 증가)
      const secuMax = city.secu_max || 1000;
      const secu = city.secu || 0;
      const secuRatio = secuMax > 0 ? secu / secuMax : 0;
      
      // 호황 발생 확률: 기본 2% + 치안 보너스 (2~7%)
      const raiseProp = 0.02 + secuRatio * 0.05;
      
      if (Math.random() > raiseProp) continue;

      const cityName = city.name || `도시 ${city.city}`;
      const nationId = city.nation || 0;

      // PHP와 동일: secu 기반 보너스 비율 계산 (치안 높으면 보너스 증가)
      const affectRatio = 1.01 + (secuRatio / 0.8) * 0.04; // 101% ~ 105%

      // 호황/풍작 효과 적용
      const popMax = city.pop_max || 100000;
      const agriMax = city.agri_max || 999;
      const commMax = city.comm_max || 999;
      const secuMaxVal = city.secu_max || 1000;
      const defMax = city.def_max || 999;
      const wallMax = city.wall_max || 999;

      city.pop = Math.min(popMax, Math.floor((city.pop || 0) * affectRatio));
      city.trust = Math.min(100, Math.floor((city.trust || 50) * affectRatio));
      city.agri = Math.min(agriMax, Math.floor((city.agri || 0) * affectRatio));
      city.comm = Math.min(commMax, Math.floor((city.comm || 0) * affectRatio));
      city.secu = Math.min(secuMaxVal, Math.floor((city.secu || 0) * affectRatio));
      city.def = Math.min(defMax, Math.floor((city.def || 0) * affectRatio));
      city.wall = Math.min(wallMax, Math.floor((city.wall || 0) * affectRatio));

      // 도시 상태 설정 (이벤트 아이콘 표시용)
      city.state = stateCode;

      // 도시 저장
      const cityData = city.toObject ? city.toObject() : { ...city, session_id: sessionId };
      await saveCity(sessionId, city.city, cityData);

      affectedCities.push(cityName);
    }

    // PHP와 동일: 영향받은 도시들을 한 번에 로그
    if (affectedCities.length > 0) {
      const targetCityNames = `<G><b>${affectedCities.join(' ')}</b></>`;
      const logger = new ActionLogger(0, 0, year, month, sessionId);
      logger.pushGlobalHistoryLog(
        `<C><b>【${eventIcon} ${eventName}】</b></>${targetCityNames}에 ${eventMessage}`
      );
      await logger.flush();
    }

    return { 
      action: 'BountifulHarvest', 
      affectedCities,
      count: affectedCities.length,
      eventType: isHarvest ? 'harvest' : 'boom'
    };
  }
}


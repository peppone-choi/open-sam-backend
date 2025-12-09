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
    const year = env['year'] || 184;
    const month = env['month'] || 1;

    // 풍년은 가을(7-9월)에 더 자주 발생
    let effectiveChance = this.chance;
    if (month >= 7 && month <= 9) {
      effectiveChance *= 2; // 가을에는 2배
    } else if (month >= 1 && month <= 3) {
      effectiveChance *= 0.5; // 겨울에는 절반
    }

    const cities = await City.find({ session_id: sessionId, nation: { $ne: 0 } });
    const affectedCities: string[] = [];

    for (const city of cities) {
      // 풍년 발생 확률 체크
      if (Math.random() > effectiveChance) continue;

      const cityName = city.name || `도시 ${city.city}`;
      const nationId = city.nation || 0;

      // 풍년 효과: 농업 +10~20%, 인구 +5%, 민심 +5
      const agriBonus = Math.floor((city.agri || 0) * (0.10 + Math.random() * 0.10));
      const popBonus = Math.floor((city.pop || 0) * 0.05);
      const trustBonus = 5;

      city.agri = Math.min(999, (city.agri || 0) + agriBonus);
      city.pop = (city.pop || 0) + popBonus;
      city.trust = Math.min(100, (city.trust || 50) + trustBonus);

      // 도시 저장
      const cityData = city.toObject ? city.toObject() : { ...city, session_id: sessionId };
      await saveCity(sessionId, city.city, cityData);

      affectedCities.push(cityName);

      // 로그 기록
      const logger = new ActionLogger(0, nationId, year, month, sessionId);
      logger.pushGlobalHistoryLog(
        `<G><b>【🌾 풍년】</b></><Y>${cityName}</>에 풍년이 들어 백성들이 기뻐하고 있습니다!`
      );
      await logger.flush();
    }

    return { 
      action: 'BountifulHarvest', 
      affectedCities,
      count: affectedCities.length 
    };
  }
}


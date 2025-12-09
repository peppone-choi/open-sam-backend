// @ts-nocheck - Type issues with Mongoose models
import { Action } from '../Action';
import { City } from '../../../models/city.model';
import { Nation } from '../../../models/nation.model';
import { ActionLogger } from '../../../types/ActionLogger';
import { saveCity, saveNation } from '../../../common/cache/model-cache.helper';

/**
 * 도적 출현 이벤트
 * 특정 확률로 도시에 도적 습격 - 자금/군량 약탈, 치안/민심 하락
 */
export class BanditRaid extends Action {
  private chance: number;

  constructor(chance: number = 0.03) { // 기본 3% 확률
    super();
    this.chance = chance;
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 184;
    const month = env['month'] || 1;

    const cities = await City.find({ session_id: sessionId, nation: { $ne: 0 } });
    const nations = await Nation.find({ session_id: sessionId });
    const nationMap = new Map(nations.map(n => [n.nation, n]));

    const affectedCities: string[] = [];

    for (const city of cities) {
      // 치안이 낮을수록 도적 출현 확률 증가
      const secuLevel = city.secu || 0;
      let effectiveChance = this.chance;
      
      if (secuLevel < 30) {
        effectiveChance *= 3; // 치안 30 미만: 3배
      } else if (secuLevel < 50) {
        effectiveChance *= 2; // 치안 50 미만: 2배
      } else if (secuLevel > 80) {
        effectiveChance *= 0.3; // 치안 80 초과: 0.3배
      }

      if (Math.random() > effectiveChance) continue;

      const cityName = city.name || `도시 ${city.city}`;
      const nationId = city.nation || 0;
      const nation = nationMap.get(nationId);

      // 도적 습격 효과
      // 1. 도시 치안 -10~20
      const secuLoss = 10 + Math.floor(Math.random() * 10);
      city.secu = Math.max(0, (city.secu || 0) - secuLoss);

      // 2. 민심 -5~10
      const trustLoss = 5 + Math.floor(Math.random() * 5);
      city.trust = Math.max(0, (city.trust || 50) - trustLoss);

      // 3. 인구 약간 감소 (도망)
      const popLoss = Math.floor((city.pop || 0) * 0.02);
      city.pop = Math.max(1000, (city.pop || 0) - popLoss);

      // 4. 국가 자금/군량 약탈 (도시 규모에 비례)
      if (nation) {
        const goldLoss = Math.floor(100 + Math.random() * 200);
        const riceLoss = Math.floor(50 + Math.random() * 150);
        
        nation.data = nation.data || {};
        nation.data.gold = Math.max(1000, (nation.data.gold || 0) - goldLoss);
        nation.data.rice = Math.max(2000, (nation.data.rice || 0) - riceLoss);

        const nationData = nation.toObject ? nation.toObject() : { ...nation.data, session_id: sessionId, nation: nationId };
        await saveNation(sessionId, nationId, nationData);
      }

      // 5. 도시 상태 설정 (이벤트 아이콘 표시용) - event4.gif = 도적
      city.state = 4;
      city.term = 2; // 2턴 동안 표시

      // 도시 저장
      const cityData = city.toObject ? city.toObject() : { ...city, session_id: sessionId };
      await saveCity(sessionId, city.city, cityData);

      affectedCities.push(cityName);

      // 로그 기록
      const logger = new ActionLogger(0, nationId, year, month, sessionId);
      logger.pushGlobalHistoryLog(
        `<R><b>【🏴‍☠️ 도적】</b></><Y>${cityName}</>에 도적떼가 출현하여 약탈을 자행했습니다!`
      );
      await logger.flush();
    }

    return { 
      action: 'BanditRaid', 
      affectedCities,
      count: affectedCities.length 
    };
  }
}


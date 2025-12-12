// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { Nation } from '../../../models/nation.model';
import { City } from '../../../models/city.model';
import { getWarGoldIncome } from '../../../utils/income-util';
import { logger } from '../../../common/logger';
import { saveNation } from '../../../common/cache/model-cache.helper';

/**
 * 전쟁 수입 처리 액션
 * PHP ProcessWarIncome Action과 동일한 구조
 * 
 * 매월 실행되며:
 * 1. 국가별 전쟁 금 수입 추가
 * 2. 도시의 부상병(dead) 20% 회복 -> pop 증가, dead 초기화
 */
export class ProcessWarIncome extends Action {
  constructor() {
    super();
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 184;
    const month = env['month'] || 1;

    try {
      const nations = await Nation.find({ session_id: sessionId });
      const cities = await City.find({ session_id: sessionId });

      // 국가별 도시 그룹화
      const cityListByNation: Record<number, any[]> = {};
      for (const city of cities) {
        const nationId = city.nation || city.data?.nation || 0;
        if (!cityListByNation[nationId]) {
          cityListByNation[nationId] = [];
        }
        cityListByNation[nationId].push(city);
      }

      // 국가별 전쟁 수입 처리
      for (const nation of nations) {
        const nationId = nation.nation || nation.data?.nation || 0;
        const level = nation.data?.level || 0;
        
        // 멸망한 국가 스킵
        if (level <= 0) {
          continue;
        }

        const cityList = cityListByNation[nationId] || [];
        const nationType = nation.data?.type || 'normal';
        
        const income = getWarGoldIncome(nationType, cityList);
        
        if (income > 0) {
          const currentGold = nation.data?.gold || 0;
          nation.data = nation.data || {};
          nation.data.gold = currentGold + income;
          nation.markModified('data');
          await nation.save();
          
          // CQRS: 캐시에 저장
          await saveNation(sessionId, nationId, nation.toObject());

          logger.debug('[ProcessWarIncome] War income added', {
            sessionId,
            nationId,
            income,
            newGold: nation.data.gold
          });
        }
      }

      // 부상병 회복 처리 (전 도시)
      // dead의 20% -> pop으로 회복, dead = 0
      for (const city of cities) {
        const dead = city.data?.dead || 0;
        
        if (dead > 0) {
          const recoveredPop = Math.floor(dead * 0.2);
          const currentPop = city.data?.pop || 0;
          
          city.data = city.data || {};
          city.data.pop = currentPop + recoveredPop;
          city.data.dead = 0;
          city.markModified('data');
          await city.save();

          logger.debug('[ProcessWarIncome] Dead recovered', {
            sessionId,
            cityId: city.city || city.data?.city,
            dead,
            recoveredPop
          });
        }
      }

      logger.info('[ProcessWarIncome] Completed', {
        sessionId,
        year,
        month,
        nationCount: nations.length,
        cityCount: cities.length
      });

      return { success: true };
    } catch (error: any) {
      logger.error('[ProcessWarIncome] Error', {
        sessionId,
        year,
        month,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

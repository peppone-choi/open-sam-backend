// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { City } from '../../../models/city.model';
import { logger } from '../../../common/logger';
import seedrandom from 'seedrandom';

/**
 * 도시 교역율 랜덤화 이벤트
 * PHP RandomizeCityTradeRate Action과 동일한 구조
 * 
 * 매월 실행되며:
 * - 도시 레벨에 따라 교역율 변동 확률 결정
 * - 변동 시 95~105% 범위로 설정
 * - 레벨 1-3: 변동 없음
 * - 레벨 4: 20% 확률
 * - 레벨 5: 40% 확률
 * - 레벨 6: 60% 확률
 * - 레벨 7: 80% 확률
 * - 레벨 8: 100% 확률
 */
export class RandomizeCityTradeRate extends Action {
  constructor() {
    super();
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 184;
    const month = env['month'] || 1;

    try {
      const cities = await City.find({ session_id: sessionId });

      // 시드 기반 랜덤 생성기 (PHP와 동일한 결과를 위해)
      const seed = `RandomizeCityTradeRate-${sessionId}-${year}-${month}`;
      const rng = seedrandom(seed);

      // 레벨별 변동 확률
      const probByLevel: Record<number, number> = {
        1: 0,
        2: 0,
        3: 0,
        4: 0.2,
        5: 0.4,
        6: 0.6,
        7: 0.8,
        8: 1
      };

      let updatedCount = 0;

      for (const city of cities) {
        const cityId = city.city || city.data?.city;
        const level = city.data?.level || city.level || 1;
        const prob = probByLevel[level] || 0;

        let newTrade: number | null = null;

        if (prob > 0 && rng() < prob) {
          // 95 ~ 105 범위로 랜덤 설정
          newTrade = Math.floor(rng() * 11) + 95; // 0-10 + 95 = 95-105
          updatedCount++;
        }

        // trade 값 업데이트
        city.data = city.data || {};
        city.data.trade = newTrade;
        city.markModified('data');
        await city.save();
      }

      logger.info('[RandomizeCityTradeRate] Completed', {
        sessionId,
        year,
        month,
        totalCities: cities.length,
        updatedCount
      });

      return { success: true, updatedCount };
    } catch (error: any) {
      logger.error('[RandomizeCityTradeRate] Error', {
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










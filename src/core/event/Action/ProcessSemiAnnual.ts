// @ts-nocheck - Type issues need investigation
import { Action } from '../Action';
import { Nation } from '../../../models/nation.model';
import { General } from '../../../models/general.model';
import { City } from '../../../models/city.model';
import { ActionLogger } from '../../../types/ActionLogger';
import { Util } from '../../../utils/Util';
import { saveNation, saveGeneral, saveCity } from '../../../common/cache/model-cache.helper';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('ProcessSemiAnnual');

/**
 * 반기 처리 액션 (6월/12월)
 * - 내정 1% 감소
 * - 인구 증가 (세율에 따라)
 * - 자금/군량 유지비 처리
 */
export class ProcessSemiAnnual extends Action {
  private resource: 'gold' | 'rice';

  constructor(resource: string) {
    super();
    if (resource !== 'gold' && resource !== 'rice') {
      throw new Error('잘못된 자원 타입');
    }
    this.resource = resource;
  }

  async run(env: any): Promise<any> {
    const sessionId = env['session_id'] || 'sangokushi_default';
    const year = env['year'] || 184;
    const month = env['month'] || 1;

    logger.info('[ProcessSemiAnnual] 반기 처리 시작', { sessionId, year, month, resource: this.resource });

    // 1. 내정 1% 감소 (모든 도시)
    await this.reduceInternalAffairs(sessionId);

    // 2. 인구 증가 처리
    await this.popIncrease(sessionId);

    // 3. 유지비 처리 (장수)
    await this.processGeneralMaintenance(sessionId);

    // 4. 유지비 처리 (국가)
    await this.processNationMaintenance(sessionId);

    // 5. 공백지 처리
    await this.processEmptyLandDecay(sessionId);

    logger.info('[ProcessSemiAnnual] 반기 처리 완료', { sessionId, year, month, resource: this.resource });

    return [ProcessSemiAnnual.name, this.resource];
  }

  /**
   * 내정 1% 감소 (모든 도시)
   */
  private async reduceInternalAffairs(sessionId: string): Promise<void> {
    const cities = await City.find({ session_id: sessionId });

    for (const city of cities) {
      // 사망자 수 초기화
      city.dead = 0;
      
      // 내정 1% 감소
      city.agri = Math.floor((city.agri || 0) * 0.99);
      city.comm = Math.floor((city.comm || 0) * 0.99);
      city.secu = Math.floor((city.secu || 0) * 0.99);
      city.def = Math.floor((city.def || 0) * 0.99);
      city.wall = Math.floor((city.wall || 0) * 0.99);

      await saveCity(sessionId, city.city, city.toObject());
    }

    logger.debug('[ProcessSemiAnnual] 내정 1% 감소 완료');
  }

  /**
   * 인구 증가 처리 (세율에 따라)
   */
  private async popIncrease(sessionId: string): Promise<void> {
    const nations = await Nation.find({ session_id: sessionId });
    const cities = await City.find({ session_id: sessionId });

    // 국가별 도시 그룹화
    const citiesByNation: Record<number, any[]> = {};
    for (const city of cities) {
      const nationId = city.nation || 0;
      if (!citiesByNation[nationId]) {
        citiesByNation[nationId] = [];
      }
      citiesByNation[nationId].push(city);
    }

    // 국가별 처리
    for (const nation of nations) {
      const nationId = nation.nation || 0;
      const nationCities = citiesByNation[nationId] || [];
      const taxRate = nation.data?.rate_tmp ?? 20;

      // 인구 증가율 계산: (30 - taxRate) / 200
      // 세율 20일 때 5%, 세율 5일 때 12.5%, 세율 50일 때 -10%
      const popRatio = (30 - taxRate) / 200;

      // 일반 내정 증가율: (20 - taxRate) / 200
      // 세율 20일 때 0%, 세율 0일 때 10%, 세율 100일 때 -40%
      const genericRatio = (20 - taxRate) / 200;

      // 민심 변화: 20 - taxRate
      const trustDiff = 20 - taxRate;

      for (const city of nationCities) {
        // 보급이 되는 도시만 처리
        if (city.supply !== 1) continue;

        const popMax = city.pop_max || 100000;
        const secuMax = city.secu_max || 1000;
        const secu = city.secu || 0;

        // 인구 증가 계산
        const basePopIncrease = 1000; // GameConst.$basePopIncreaseAmount
        if (popRatio >= 0) {
          city.pop = Math.min(popMax, basePopIncrease + Math.floor((city.pop || 0) * (1 + popRatio * (1 + secu / secuMax / 10))));
        } else {
          city.pop = Math.min(popMax, basePopIncrease + Math.floor((city.pop || 0) * (1 + popRatio * (1 - secu / secuMax / 10))));
        }

        // 내정 증가
        city.agri = Math.min(city.agri_max || 10000, Math.floor((city.agri || 0) * (1 + genericRatio)));
        city.comm = Math.min(city.comm_max || 10000, Math.floor((city.comm || 0) * (1 + genericRatio)));
        city.secu = Math.min(city.secu_max || 1000, Math.floor((city.secu || 0) * (1 + genericRatio)));
        city.def = Math.min(city.def_max || 10000, Math.floor((city.def || 0) * (1 + genericRatio)));
        city.wall = Math.min(city.wall_max || 5000, Math.floor((city.wall || 0) * (1 + genericRatio)));

        // 민심 변화
        city.trust = Math.max(0, Math.min(100, (city.trust || 50) + trustDiff));

        await saveCity(sessionId, city.city, city.toObject());
      }
    }

    logger.debug('[ProcessSemiAnnual] 인구 증가 처리 완료');
  }

  /**
   * 장수 자원 유지비 처리
   * - 10000 초과: 3% 감소
   * - 1000~10000: 1% 감소
   */
  private async processGeneralMaintenance(sessionId: string): Promise<void> {
    const generals = await General.find({ session_id: sessionId });
    const resource = this.resource;

    for (const general of generals) {
      const currentAmount = general.data?.[resource] || 0;

      if (currentAmount > 1000) {
        let newAmount: number;
        if (currentAmount > 10000) {
          newAmount = Math.floor(currentAmount * 0.97);
        } else {
          newAmount = Math.floor(currentAmount * 0.99);
        }
        general.data[resource] = newAmount;
        await saveGeneral(sessionId, general.no || general.data?.no, general.toObject());
      }
    }

    logger.debug('[ProcessSemiAnnual] 장수 유지비 처리 완료');
  }

  /**
   * 국가 자원 유지비 처리
   * - 100000 초과: 5% 감소
   * - 10000~100000: 3% 감소
   * - 1000~10000: 1% 감소
   */
  private async processNationMaintenance(sessionId: string): Promise<void> {
    const nations = await Nation.find({ session_id: sessionId });
    const resource = this.resource;

    for (const nation of nations) {
      const currentAmount = nation.data?.[resource] || 0;

      if (currentAmount > 1000) {
        let newAmount: number;
        if (currentAmount > 100000) {
          newAmount = Math.floor(currentAmount * 0.95);
        } else if (currentAmount > 10000) {
          newAmount = Math.floor(currentAmount * 0.97);
        } else {
          newAmount = Math.floor(currentAmount * 0.99);
        }
        nation.data[resource] = newAmount;
        await saveNation(sessionId, nation.nation, nation.toObject());
      }
    }

    logger.debug('[ProcessSemiAnnual] 국가 유지비 처리 완료');
  }

  /**
   * 공백지 내정 감소 (민심 50으로 고정, 내정 1% 추가 감소)
   */
  private async processEmptyLandDecay(sessionId: string): Promise<void> {
    const emptyLandCities = await City.find({ session_id: sessionId, nation: 0 });

    for (const city of emptyLandCities) {
      city.trust = 50;
      city.agri = Math.floor((city.agri || 0) * 0.99);
      city.comm = Math.floor((city.comm || 0) * 0.99);
      city.secu = Math.floor((city.secu || 0) * 0.99);
      city.def = Math.floor((city.def || 0) * 0.99);
      city.wall = Math.floor((city.wall || 0) * 0.99);

      await saveCity(sessionId, city.city, city.toObject());
    }

    logger.debug('[ProcessSemiAnnual] 공백지 처리 완료');
  }
}



/**
 * CityGrowthService
 * 도시 성장 및 인구 증가/감소 시스템
 * 
 * 기능:
 * - 인구 자연 증가/감소
 * - 내정 수치 자동 회복
 * - 도시 특성별 보너스 적용
 * - 전투/포위 상태에 따른 감소
 */

import { City, ICity } from '../../models/city.model';
import { cityRepository } from '../../repositories/city.repository';
import { Util } from '../../utils/Util';

/**
 * 도시 등급별 기본 성장률
 * PHP GameConst 참조
 */
export const CITY_GROWTH_RATES = {
  1: { pop: 0.005, internal: 0.02 },  // 수 (수비)
  2: { pop: 0.005, internal: 0.02 },  // 진 (진지)
  3: { pop: 0.008, internal: 0.03 },  // 관 (관문)
  4: { pop: 0.010, internal: 0.04 },  // 이 (이민족)
  5: { pop: 0.012, internal: 0.05 },  // 소
  6: { pop: 0.015, internal: 0.06 },  // 중
  7: { pop: 0.018, internal: 0.07 },  // 대
  8: { pop: 0.020, internal: 0.08 },  // 특
};

/**
 * 지역별 보너스
 */
export const REGION_BONUSES: Record<string | number, { pop: number; agri: number; comm: number }> = {
  // 하북 - 농업 보너스
  '하북': { pop: 1.0, agri: 1.1, comm: 1.0 },
  1: { pop: 1.0, agri: 1.1, comm: 1.0 },
  // 중원 - 균형
  '중원': { pop: 1.1, agri: 1.0, comm: 1.0 },
  2: { pop: 1.1, agri: 1.0, comm: 1.0 },
  // 서북 - 군사
  '서북': { pop: 0.9, agri: 0.9, comm: 0.9 },
  3: { pop: 0.9, agri: 0.9, comm: 0.9 },
  // 서촉 - 농업
  '서촉': { pop: 1.0, agri: 1.2, comm: 0.9 },
  4: { pop: 1.0, agri: 1.2, comm: 0.9 },
  // 남중 - 낮은 성장
  '남중': { pop: 0.8, agri: 0.8, comm: 0.8 },
  5: { pop: 0.8, agri: 0.8, comm: 0.8 },
  // 초 - 균형
  '초': { pop: 1.0, agri: 1.0, comm: 1.1 },
  6: { pop: 1.0, agri: 1.0, comm: 1.1 },
  // 오월 - 상업
  '오월': { pop: 1.0, agri: 0.9, comm: 1.2 },
  7: { pop: 1.0, agri: 0.9, comm: 1.2 },
  // 동이 - 군사
  '동이': { pop: 0.9, agri: 0.9, comm: 0.9 },
  8: { pop: 0.9, agri: 0.9, comm: 0.9 },
};

/**
 * 도시 상태 코드
 */
export enum CityState {
  NORMAL = 0,       // 정상
  SIEGE = 1,        // 포위 상태
  BATTLE = 2,       // 전투 중
  REBELLION = 3,    // 반란
  DAMAGED = 4,      // 피해 상태
}

export class CityGrowthService {
  /**
   * 단일 도시 인구 증가 계산
   */
  static calculatePopulationGrowth(city: Partial<ICity>): number {
    const level = city.level || 1;
    const currentPop = city.pop || 0;
    const maxPop = city.pop_max || 100000;
    const trust = city.trust || 50;
    const state = city.state || CityState.NORMAL;

    // 기본 성장률
    const baseRate = CITY_GROWTH_RATES[level as keyof typeof CITY_GROWTH_RATES]?.pop || 0.01;

    // 지역 보너스
    const region = city.region || 0;
    const regionBonus = REGION_BONUSES[region]?.pop || 1.0;

    // 민심 보너스 (50 기준, ±50% 범위)
    const trustBonus = 0.5 + (trust / 100);

    // 인구 밀도 페널티 (최대 인구에 가까울수록 성장 감소)
    const densityRatio = currentPop / maxPop;
    const densityPenalty = Math.max(0.1, 1 - (densityRatio * 0.8));

    // 상태에 따른 영향
    let stateMod = 1.0;
    switch (state) {
      case CityState.SIEGE:
        stateMod = -0.5; // 포위 시 인구 감소
        break;
      case CityState.BATTLE:
        stateMod = -0.3; // 전투 중 인구 감소
        break;
      case CityState.REBELLION:
        stateMod = -0.2; // 반란 시 인구 감소
        break;
      case CityState.DAMAGED:
        stateMod = 0.3;  // 피해 상태 성장 감소
        break;
    }

    // 최종 성장량 계산
    const growthRate = baseRate * regionBonus * trustBonus * densityPenalty * stateMod;
    const growth = Math.round(currentPop * growthRate);

    // 최소/최대 제한
    const minGrowth = state > CityState.NORMAL ? -Math.round(currentPop * 0.05) : 0;
    const maxGrowth = Math.round((maxPop - currentPop) * 0.1);

    return Util.clamp(growth, minGrowth, maxGrowth);
  }

  /**
   * 내정 수치 자동 회복 계산
   */
  static calculateInternalRecovery(city: Partial<ICity>): {
    agri: number;
    comm: number;
    secu: number;
    def: number;
    wall: number;
  } {
    const level = city.level || 1;
    const trust = city.trust || 50;
    const state = city.state || CityState.NORMAL;
    const region = city.region || 0;

    const baseRate = CITY_GROWTH_RATES[level as keyof typeof CITY_GROWTH_RATES]?.internal || 0.03;
    const trustMod = trust / 100;
    const regionBonus = REGION_BONUSES[region] || { pop: 1, agri: 1, comm: 1 };

    // 상태에 따른 감소
    const stateMod = state === CityState.NORMAL ? 1.0 : 0.5;

    const calcRecovery = (current: number, max: number, bonus: number = 1.0) => {
      if (current >= max) return 0;
      const rate = baseRate * trustMod * stateMod * bonus;
      const recovery = Math.round(max * rate);
      return Math.min(recovery, max - current);
    };

    return {
      agri: calcRecovery(city.agri || 0, city.agri_max || 10000, regionBonus.agri),
      comm: calcRecovery(city.comm || 0, city.comm_max || 10000, regionBonus.comm),
      secu: calcRecovery(city.secu || 0, city.secu_max || 1000),
      def: calcRecovery(city.def || 0, city.def_max || 1000),
      wall: calcRecovery(city.wall || 0, city.wall_max || 10000),
    };
  }

  /**
   * 민심 자동 변화 계산
   */
  static calculateTrustChange(city: Partial<ICity>): number {
    const currentTrust = city.trust || 50;
    const state = city.state || CityState.NORMAL;
    const secu = city.secu || 0;
    const secuMax = city.secu_max || 1000;

    // 치안 비율에 따른 민심 변화
    const secuRatio = secu / secuMax;
    let trustChange = 0;

    if (secuRatio > 0.8) {
      // 치안 80% 이상: 민심 상승
      trustChange = Math.round((secuRatio - 0.8) * 10);
    } else if (secuRatio < 0.3) {
      // 치안 30% 미만: 민심 하락
      trustChange = -Math.round((0.3 - secuRatio) * 10);
    }

    // 상태에 따른 추가 변화
    switch (state) {
      case CityState.SIEGE:
        trustChange -= 5;
        break;
      case CityState.BATTLE:
        trustChange -= 3;
        break;
      case CityState.REBELLION:
        trustChange -= 10;
        break;
    }

    // 50으로 수렴하는 경향
    if (currentTrust > 70) {
      trustChange -= 1;
    } else if (currentTrust < 30) {
      trustChange += 1;
    }

    // 최종 범위 제한 (0~100)
    const newTrust = Util.clamp(currentTrust + trustChange, 0, 100);
    return newTrust - currentTrust;
  }

  /**
   * 단일 도시 성장 처리
   */
  static async processCity(sessionId: string, cityId: number): Promise<{
    success: boolean;
    changes: Record<string, number>;
    message?: string;
  }> {
    try {
      const city = await cityRepository.findByCityNum(sessionId, cityId) as any;
      if (!city) {
        return { success: false, changes: {}, message: '도시를 찾을 수 없습니다' };
      }

      const cityData = { ...city, ...(city.data || {}) } as Partial<ICity>;

      // 인구 성장
      const popGrowth = this.calculatePopulationGrowth(cityData);

      // 내정 회복
      const internalRecovery = this.calculateInternalRecovery(cityData);

      // 민심 변화
      const trustChange = this.calculateTrustChange(cityData);

      // 업데이트 적용
      const updates: Record<string, number> = {};

      if (popGrowth !== 0) {
        const newPop = Math.max(0, (cityData.pop || 0) + popGrowth);
        updates.pop = Math.min(newPop, cityData.pop_max || 1000000);
      }

      if (internalRecovery.agri > 0) {
        updates.agri = (cityData.agri || 0) + internalRecovery.agri;
      }
      if (internalRecovery.comm > 0) {
        updates.comm = (cityData.comm || 0) + internalRecovery.comm;
      }
      if (internalRecovery.secu > 0) {
        updates.secu = (cityData.secu || 0) + internalRecovery.secu;
      }
      if (internalRecovery.def > 0) {
        updates.def = (cityData.def || 0) + internalRecovery.def;
      }
      if (internalRecovery.wall > 0) {
        updates.wall = (cityData.wall || 0) + internalRecovery.wall;
      }

      if (trustChange !== 0) {
        updates.trust = (cityData.trust || 50) + trustChange;
      }

      if (Object.keys(updates).length > 0) {
        await cityRepository.updateByCityNum(sessionId, cityId, updates);
      }

      return {
        success: true,
        changes: {
          pop: popGrowth,
          ...internalRecovery,
          trust: trustChange,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        changes: {},
        message: error.message,
      };
    }
  }

  /**
   * 세션 전체 도시 성장 처리 (턴 프로세서에서 호출)
   */
  static async processAllCities(sessionId: string): Promise<{
    success: boolean;
    processed: number;
    totalPopGrowth: number;
    message?: string;
  }> {
    try {
      const cities = await cityRepository.findByFilter({ session_id: sessionId });
      let processed = 0;
      let totalPopGrowth = 0;

      for (const city of cities) {
        const cityId = city.city || city.data?.city;
        if (!cityId) continue;

        const result = await this.processCity(sessionId, cityId);
        if (result.success) {
          processed++;
          totalPopGrowth += result.changes.pop || 0;
        }
      }

      return {
        success: true,
        processed,
        totalPopGrowth,
      };
    } catch (error: any) {
      return {
        success: false,
        processed: 0,
        totalPopGrowth: 0,
        message: error.message,
      };
    }
  }

  /**
   * 특정 국가의 도시들만 성장 처리
   */
  static async processNationCities(sessionId: string, nationId: number): Promise<{
    success: boolean;
    processed: number;
    totalPopGrowth: number;
  }> {
    try {
      const cities = await cityRepository.findByFilter({
        session_id: sessionId,
        nation: nationId,
      });

      let processed = 0;
      let totalPopGrowth = 0;

      for (const city of cities) {
        const cityId = city.city || city.data?.city;
        if (!cityId) continue;

        const result = await this.processCity(sessionId, cityId);
        if (result.success) {
          processed++;
          totalPopGrowth += result.changes.pop || 0;
        }
      }

      return {
        success: true,
        processed,
        totalPopGrowth,
      };
    } catch (error: any) {
      return {
        success: false,
        processed: 0,
        totalPopGrowth: 0,
      };
    }
  }

  /**
   * 도시 피해 적용 (전투/재해 등)
   */
  static async applyDamage(
    sessionId: string,
    cityId: number,
    damage: {
      pop?: number;
      agri?: number;
      comm?: number;
      secu?: number;
      def?: number;
      wall?: number;
      trust?: number;
    }
  ): Promise<boolean> {
    try {
      const city = await cityRepository.findByCityNum(sessionId, cityId) as Partial<ICity> | null;
      if (!city) return false;

      const updates: Record<string, number> = {};

      if (damage.pop) {
        updates.pop = Math.max(0, (city.pop ?? 0) - damage.pop);
      }
      if (damage.agri) {
        updates.agri = Math.max(0, (city.agri ?? 0) - damage.agri);
      }
      if (damage.comm) {
        updates.comm = Math.max(0, (city.comm ?? 0) - damage.comm);
      }
      if (damage.secu) {
        updates.secu = Math.max(0, (city.secu ?? 0) - damage.secu);
      }
      if (damage.def) {
        updates.def = Math.max(0, (city.def ?? 0) - damage.def);
      }
      if (damage.wall) {
        updates.wall = Math.max(0, (city.wall ?? 0) - damage.wall);
      }
      if (damage.trust) {
        updates.trust = Util.clamp((city.trust ?? 50) - damage.trust, 0, 100);
      }

      if (Object.keys(updates).length > 0) {
        await cityRepository.updateByCityNum(sessionId, cityId, updates);
      }

      return true;
    } catch (error) {
      console.error('도시 피해 적용 실패:', error);
      return false;
    }
  }

  /**
   * 도시 상태 변경
   */
  static async setCityState(
    sessionId: string,
    cityId: number,
    state: CityState
  ): Promise<boolean> {
    try {
      await cityRepository.updateByCityNum(sessionId, cityId, { state });
      return true;
    } catch (error) {
      console.error('도시 상태 변경 실패:', error);
      return false;
    }
  }

  /**
   * 도시 성장 시뮬레이션 (예측)
   */
  static simulateGrowth(city: Partial<ICity>, turns: number = 12): {
    pop: number[];
    trust: number[];
  } {
    const popHistory: number[] = [];
    const trustHistory: number[] = [];

    let simulatedCity = { ...city };

    for (let i = 0; i < turns; i++) {
      const popGrowth = this.calculatePopulationGrowth(simulatedCity);
      const trustChange = this.calculateTrustChange(simulatedCity);

      simulatedCity.pop = Math.min(
        (simulatedCity.pop || 0) + popGrowth,
        simulatedCity.pop_max || 1000000
      );
      simulatedCity.trust = Util.clamp(
        (simulatedCity.trust || 50) + trustChange,
        0,
        100
      );

      popHistory.push(simulatedCity.pop);
      trustHistory.push(simulatedCity.trust);
    }

    return { pop: popHistory, trust: trustHistory };
  }
}


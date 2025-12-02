/**
 * NationStatsService
 * 국력 계산 및 순위 시스템
 * 
 * 기능:
 * - 국력 지수 계산
 * - 세력 순위 시스템
 * - 통계 집계
 * - 순위 변동 추적
 */

import { Nation, INation } from '../../models/nation.model';
import { City } from '../../models/city.model';
import { General } from '../../models/general.model';
import { nationRepository } from '../../repositories/nation.repository';
import { cityRepository } from '../../repositories/city.repository';
import { generalRepository } from '../../repositories/general.repository';

/**
 * 국력 계산 가중치
 */
export const POWER_WEIGHTS = {
  population: 0.0001,    // 인구 가중치 (10만명 = 10)
  cities: 10,            // 도시당 점수
  generals: 5,           // 장수당 점수
  gold: 0.001,           // 금 가중치 (1000금 = 1)
  rice: 0.001,           // 쌀 가중치 (1000쌀 = 1)
  tech: 0.5,             // 기술 가중치
  military: 0.01,        // 병력 가중치 (100명 = 1)
  facilities: 0.001,     // 시설 가중치
  avgAbility: 0.5,       // 장수 평균 능력치 가중치
};

/**
 * 국가 통계 인터페이스
 */
export interface NationStats {
  nation: number;
  name: string;
  color: string;
  level: number;
  
  // 기본 자원
  gold: number;
  rice: number;
  tech: number;
  
  // 영토
  cityCount: number;
  totalPopulation: number;
  totalAgri: number;
  totalComm: number;
  totalDef: number;
  totalWall: number;
  
  // 군사
  generalCount: number;
  totalCrew: number;
  totalTrain: number;
  totalMorale: number;
  
  // 평균 능력치
  avgLeadership: number;
  avgStrength: number;
  avgIntel: number;
  avgExperience: number;
  
  // 평균 숙련도
  avgDex1: number;  // 보병
  avgDex2: number;  // 궁병
  avgDex3: number;  // 기병
  avgDex4: number;  // 귀족
  avgDex5: number;  // 차병
  
  // 국력 점수
  power: number;
  militaryPower: number;
  economicPower: number;
  
  // 순위
  rank?: number;
  previousRank?: number;
  rankChange?: number;
}

export class NationStatsService {
  /**
   * 단일 국가의 통계 계산
   */
  static async calculateNationStats(sessionId: string, nationId: number): Promise<NationStats | null> {
    try {
      const nation = await nationRepository.findByNationNum(sessionId, nationId);
      if (!nation) return null;

      const nationData = nation.data || {};

      // 소속 도시 조회
      const cities = await cityRepository.findByFilter({
        session_id: sessionId,
        nation: nationId,
      });

      // 소속 장수 조회
      const generals = await generalRepository.findByFilter({
        session_id: sessionId,
        'data.nation': nationId,
      });

      // 도시 통계 계산
      let totalPopulation = 0;
      let totalAgri = 0;
      let totalComm = 0;
      let totalDef = 0;
      let totalWall = 0;

      for (const city of cities) {
        const cityData = city.data || {};
        totalPopulation += city.pop || cityData.pop || 0;
        totalAgri += city.agri || cityData.agri || 0;
        totalComm += city.comm || cityData.comm || 0;
        totalDef += city.def || cityData.def || 0;
        totalWall += city.wall || cityData.wall || 0;
      }

      // 장수 통계 계산
      let totalCrew = 0;
      let totalTrain = 0;
      let totalMorale = 0;
      let sumLeadership = 0;
      let sumStrength = 0;
      let sumIntel = 0;
      let sumExperience = 0;
      let sumDex1 = 0, sumDex2 = 0, sumDex3 = 0, sumDex4 = 0, sumDex5 = 0;

      for (const general of generals) {
        const genData = general.data || {};
        
        totalCrew += genData.crew || 0;
        totalTrain += genData.train || 0;
        totalMorale += genData.atmos || genData.morale || 0;
        
        sumLeadership += genData.leadership || 0;
        sumStrength += genData.strength || 0;
        sumIntel += genData.intel || 0;
        sumExperience += genData.experience || 0;
        
        sumDex1 += genData.dex1 || 0;
        sumDex2 += genData.dex2 || 0;
        sumDex3 += genData.dex3 || 0;
        sumDex4 += genData.dex4 || 0;
        sumDex5 += genData.dex5 || 0;
      }

      const generalCount = generals.length || 1; // 0으로 나누기 방지

      // 평균 계산
      const avgLeadership = Math.round(sumLeadership / generalCount);
      const avgStrength = Math.round(sumStrength / generalCount);
      const avgIntel = Math.round(sumIntel / generalCount);
      const avgExperience = Math.round(sumExperience / generalCount);
      const avgDex1 = Math.round(sumDex1 / generalCount);
      const avgDex2 = Math.round(sumDex2 / generalCount);
      const avgDex3 = Math.round(sumDex3 / generalCount);
      const avgDex4 = Math.round(sumDex4 / generalCount);
      const avgDex5 = Math.round(sumDex5 / generalCount);

      // 국력 계산
      const economicPower = Math.round(
        totalPopulation * POWER_WEIGHTS.population +
        totalAgri * POWER_WEIGHTS.facilities +
        totalComm * POWER_WEIGHTS.facilities +
        (nationData.gold || 0) * POWER_WEIGHTS.gold +
        (nationData.rice || 0) * POWER_WEIGHTS.rice
      );

      const militaryPower = Math.round(
        totalCrew * POWER_WEIGHTS.military +
        totalDef * POWER_WEIGHTS.facilities +
        totalWall * POWER_WEIGHTS.facilities +
        generals.length * POWER_WEIGHTS.generals +
        (avgLeadership + avgStrength + avgIntel) * POWER_WEIGHTS.avgAbility
      );

      const power = Math.round(
        economicPower +
        militaryPower +
        cities.length * POWER_WEIGHTS.cities +
        (nationData.tech || 0) * POWER_WEIGHTS.tech
      );

      return {
        nation: nationId,
        name: nation.name || nationData.name || '무명',
        color: nation.color || nationData.color || '#000000',
        level: nation.level || nationData.level || 0,
        
        gold: nationData.gold || 0,
        rice: nationData.rice || 0,
        tech: nationData.tech || 0,
        
        cityCount: cities.length,
        totalPopulation,
        totalAgri,
        totalComm,
        totalDef,
        totalWall,
        
        generalCount: generals.length,
        totalCrew,
        totalTrain: Math.round(totalTrain / generalCount),
        totalMorale: Math.round(totalMorale / generalCount),
        
        avgLeadership,
        avgStrength,
        avgIntel,
        avgExperience,
        
        avgDex1,
        avgDex2,
        avgDex3,
        avgDex4,
        avgDex5,
        
        power,
        militaryPower,
        economicPower,
      };
    } catch (error: any) {
      console.error('국가 통계 계산 실패:', error);
      return null;
    }
  }

  /**
   * 모든 국가의 순위 계산
   */
  static async calculateAllRankings(sessionId: string): Promise<NationStats[]> {
    try {
      const nations = await nationRepository.findByFilter({ session_id: sessionId });
      const statsPromises = nations.map(async (nation) => {
        const nationId = nation.nation || nation.data?.nation;
        if (!nationId || nationId === 0) return null;
        return this.calculateNationStats(sessionId, nationId);
      });

      const allStats = (await Promise.all(statsPromises)).filter(
        (s): s is NationStats => s !== null
      );

      // 국력순 정렬
      allStats.sort((a, b) => b.power - a.power);

      // 순위 부여
      allStats.forEach((stats, index) => {
        stats.rank = index + 1;
      });

      return allStats;
    } catch (error: any) {
      console.error('순위 계산 실패:', error);
      return [];
    }
  }

  /**
   * 순위 변동 계산 및 저장
   */
  static async updateRankings(sessionId: string): Promise<{
    success: boolean;
    rankings: NationStats[];
    changes: Array<{ nation: number; from: number; to: number }>;
  }> {
    try {
      // 이전 순위 로드 (nation.data.rank에서)
      const previousRanks: Record<number, number> = {};
      const nations = await nationRepository.findByFilter({ session_id: sessionId });
      
      for (const nation of nations) {
        const nationId = nation.nation || nation.data?.nation;
        const prevRank = nation.data?.rank || 0;
        if (nationId) {
          previousRanks[nationId] = prevRank;
        }
      }

      // 새 순위 계산
      const rankings = await this.calculateAllRankings(sessionId);
      const changes: Array<{ nation: number; from: number; to: number }> = [];

      // 순위 저장 및 변동 계산
      for (const stats of rankings) {
        const prevRank = previousRanks[stats.nation] || 0;
        stats.previousRank = prevRank;
        stats.rankChange = prevRank > 0 ? prevRank - (stats.rank || 0) : 0;

        if (prevRank !== stats.rank && prevRank > 0) {
          changes.push({
            nation: stats.nation,
            from: prevRank,
            to: stats.rank || 0,
          });
        }

        // DB에 순위 및 국력 저장
        await nationRepository.updateByNationNum(sessionId, stats.nation, {
          'data.power': stats.power,
          'data.rank': stats.rank,
          'data.prev_rank': prevRank,
          'data.military_power': stats.militaryPower,
          'data.economic_power': stats.economicPower,
        });
      }

      return {
        success: true,
        rankings,
        changes,
      };
    } catch (error: any) {
      console.error('순위 업데이트 실패:', error);
      return {
        success: false,
        rankings: [],
        changes: [],
      };
    }
  }

  /**
   * 특정 정렬 기준으로 국가 순위 조회
   */
  static async getRankingsByType(
    sessionId: string,
    sortType: 'power' | 'military' | 'economic' | 'population' | 'cities' | 'generals' | 'tech'
  ): Promise<NationStats[]> {
    const rankings = await this.calculateAllRankings(sessionId);

    const sortFunctions: Record<string, (a: NationStats, b: NationStats) => number> = {
      power: (a, b) => b.power - a.power,
      military: (a, b) => b.militaryPower - a.militaryPower,
      economic: (a, b) => b.economicPower - a.economicPower,
      population: (a, b) => b.totalPopulation - a.totalPopulation,
      cities: (a, b) => b.cityCount - a.cityCount,
      generals: (a, b) => b.generalCount - a.generalCount,
      tech: (a, b) => b.tech - a.tech,
    };

    rankings.sort(sortFunctions[sortType] || sortFunctions.power);

    // 재순위 부여
    rankings.forEach((stats, index) => {
      stats.rank = index + 1;
    });

    return rankings;
  }

  /**
   * 세력 비교 데이터 생성
   */
  static async compareNations(
    sessionId: string,
    nationIds: number[]
  ): Promise<Record<number, NationStats>> {
    const result: Record<number, NationStats> = {};

    for (const nationId of nationIds) {
      const stats = await this.calculateNationStats(sessionId, nationId);
      if (stats) {
        result[nationId] = stats;
      }
    }

    return result;
  }

  /**
   * 국력 변동 히스토리 저장
   */
  static async recordPowerHistory(sessionId: string): Promise<boolean> {
    try {
      const rankings = await this.calculateAllRankings(sessionId);
      const timestamp = new Date().toISOString();

      for (const stats of rankings) {
        const nation = await nationRepository.findByNationNum(sessionId, stats.nation);
        if (!nation) continue;

        const history = nation.data?.power_history || [];
        history.push({
          timestamp,
          power: stats.power,
          rank: stats.rank,
          military: stats.militaryPower,
          economic: stats.economicPower,
        });

        // 최대 100개 기록 유지
        while (history.length > 100) {
          history.shift();
        }

        await nationRepository.updateByNationNum(sessionId, stats.nation, {
          'data.power_history': history,
        });
      }

      return true;
    } catch (error: any) {
      console.error('국력 히스토리 저장 실패:', error);
      return false;
    }
  }

  /**
   * 국가 상세 통계 (API 응답용)
   */
  static async getNationDetailedStats(sessionId: string, nationId: number): Promise<{
    success: boolean;
    stats?: NationStats;
    comparison?: {
      avgPower: number;
      rankPercentile: number;
    };
    message?: string;
  }> {
    try {
      const stats = await this.calculateNationStats(sessionId, nationId);
      if (!stats) {
        return { success: false, message: '국가를 찾을 수 없습니다' };
      }

      // 전체 국가 대비 비교
      const allRankings = await this.calculateAllRankings(sessionId);
      const avgPower =
        allRankings.reduce((sum, s) => sum + s.power, 0) / (allRankings.length || 1);
      const rankPercentile = stats.rank
        ? Math.round(((allRankings.length - stats.rank + 1) / allRankings.length) * 100)
        : 0;

      return {
        success: true,
        stats,
        comparison: {
          avgPower: Math.round(avgPower),
          rankPercentile,
        },
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 세력 균형 지수 계산 (게임 밸런스용)
   */
  static async calculateBalanceIndex(sessionId: string): Promise<{
    balance: number;
    top3Share: number;
    giniCoefficient: number;
  }> {
    const rankings = await this.calculateAllRankings(sessionId);
    
    if (rankings.length < 2) {
      return { balance: 100, top3Share: 0, giniCoefficient: 0 };
    }

    const totalPower = rankings.reduce((sum, s) => sum + s.power, 0);
    
    // 상위 3개국 점유율
    const top3Power = rankings.slice(0, 3).reduce((sum, s) => sum + s.power, 0);
    const top3Share = Math.round((top3Power / totalPower) * 100);

    // 지니 계수 계산 (불평등 지수)
    const n = rankings.length;
    const powers = rankings.map(s => s.power);
    let giniSum = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        giniSum += Math.abs(powers[i] - powers[j]);
      }
    }
    const giniCoefficient = giniSum / (2 * n * n * (totalPower / n));

    // 균형 지수 (100이 완전 균형, 0이 극단적 불균형)
    const balance = Math.round((1 - giniCoefficient) * 100);

    return {
      balance,
      top3Share,
      giniCoefficient: Math.round(giniCoefficient * 1000) / 1000,
    };
  }
}



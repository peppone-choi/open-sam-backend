import { nationRepository } from '../../repositories/nation.repository';
import { generalRepository } from '../../repositories/general.repository';
import { cityRepository } from '../../repositories/city.repository';

/**
 * AdminNationStats Service
 * 국가 통계 조회 (PHP: _admin5.php)
 * 
 * 기능:
 * - 국가별 상세 통계 조회 (국력/장수/기술/자원/평균능력치/숙련도/병력/인구/시설)
 * - 17가지 정렬 옵션
 * - 장수 국가 변경
 */
export class AdminNationStatsService {
  /**
   * 국가 통계 조회
   * @param sessionId - 세션 ID
   * @param sortType - 정렬 타입 (0-17)
   *   0: 국력, 1: 장수, 2: 기술, 3: 국고, 4: 병량,
   *   5: 평금, 6: 평쌀, 7: 평통, 8: 평무, 9: 평지, 10: 평Lv,
   *   13: 보숙, 14: 궁숙, 15: 기숙, 16: 귀숙, 17: 차숙
   */
  static async getNationStats(sessionId: string, sortType: number = 0) {
    try {
      // 모든 국가 조회
      const nations = await nationRepository.findByFilter({ session_id: sessionId });

      // 각 국가별 상세 통계 수집
      const statsPromises = nations.map(async (nation: any) => {
        const nationId = nation.nation || nation.data?.nation || 0;

        // 장수 통계
        const generals = await generalRepository.findByFilter({
          session_id: sessionId,
          nation: nationId,
        });

        const generalStats = this.calculateGeneralStats(generals);

        // 도시 통계
        const cities = await cityRepository.findByFilter({
          session_id: sessionId,
          nation: nationId,
        });

        const cityStats = this.calculateCityStats(cities);

        return {
          nation: nationId,
          name: nation.name || nation.data?.name || '무명',
          color: nation.color || nation.data?.color || '#000000',
          power: nation.power || nation.data?.power || 0,
          tech: nation.tech || nation.data?.tech || 0,
          strategic_cmd_limit: nation.strategic_cmd_limit || nation.data?.strategic_cmd_limit || 0,
          gold: nation.gold || nation.data?.gold || 0,
          rice: nation.rice || nation.data?.rice || 0,
          level: nation.level || nation.data?.level || 0,
          ...generalStats,
          ...cityStats,
        };
      });

      let stats = await Promise.all(statsPromises);

      // 정렬
      stats = this.sortStats(stats, sortType);

      return {
        success: true,
        stats,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 장수 통계 계산
   */
  private static calculateGeneralStats(generals: any[]) {
    if (generals.length === 0) {
      return {
        gennum: 0,
        avg_gold: 0,
        avg_rice: 0,
        avg_leadership: 0,
        avg_strength: 0,
        avg_intel: 0,
        avg_explevel: 0,
        avg_dex1: 0,
        avg_dex2: 0,
        avg_dex3: 0,
        avg_dex4: 0,
        avg_dex5: 0,
        total_crew: 0,
        total_leadership: 0,
      };
    }

    const sum = generals.reduce((acc, gen) => {
      const data = gen.data || gen;
      return {
        gold: acc.gold + (data.gold || 0),
        rice: acc.rice + (data.rice || 0),
        leadership: acc.leadership + (data.leadership || 0),
        strength: acc.strength + (data.strength || 0),
        intel: acc.intel + (data.intel || 0),
        explevel: acc.explevel + (data.explevel || 0),
        dex1: acc.dex1 + (data.dex1 || 0),
        dex2: acc.dex2 + (data.dex2 || 0),
        dex3: acc.dex3 + (data.dex3 || 0),
        dex4: acc.dex4 + (data.dex4 || 0),
        dex5: acc.dex5 + (data.dex5 || 0),
        crew: acc.crew + (data.crew || 0),
      };
    }, {
      gold: 0,
      rice: 0,
      leadership: 0,
      strength: 0,
      intel: 0,
      explevel: 0,
      dex1: 0,
      dex2: 0,
      dex3: 0,
      dex4: 0,
      dex5: 0,
      crew: 0,
    });

    const count = generals.length;

    return {
      gennum: count,
      avg_gold: Math.round(sum.gold / count),
      avg_rice: Math.round(sum.rice / count),
      avg_leadership: Math.round((sum.leadership / count) * 10) / 10,
      avg_strength: Math.round((sum.strength / count) * 10) / 10,
      avg_intel: Math.round((sum.intel / count) * 10) / 10,
      avg_explevel: Math.round((sum.explevel / count) * 10) / 10,
      avg_dex1: Math.round(sum.dex1 / count),
      avg_dex2: Math.round(sum.dex2 / count),
      avg_dex3: Math.round(sum.dex3 / count),
      avg_dex4: Math.round(sum.dex4 / count),
      avg_dex5: Math.round(sum.dex5 / count),
      total_crew: sum.crew,
      total_leadership: sum.leadership,
    };
  }

  /**
   * 도시 통계 계산
   */
  private static calculateCityStats(cities: any[]) {
    if (cities.length === 0) {
      return {
        city_count: 0,
        total_pop: 0,
        total_pop_max: 0,
        pop_rate: 0,
        agri_rate: 0,
        comm_rate: 0,
        secu_rate: 0,
        wall_rate: 0,
        def_rate: 0,
      };
    }

    const sum = cities.reduce((acc, city) => {
      const data = city.data || city;
      return {
        pop: acc.pop + (data.pop || 0),
        pop_max: acc.pop_max + (data.pop_max || 0),
        agri: acc.agri + (data.agri || 0),
        agri_max: acc.agri_max + (data.agri_max || 0),
        comm: acc.comm + (data.comm || 0),
        comm_max: acc.comm_max + (data.comm_max || 0),
        secu: acc.secu + (data.secu || 0),
        secu_max: acc.secu_max + (data.secu_max || 0),
        wall: acc.wall + (data.wall || 0),
        wall_max: acc.wall_max + (data.wall_max || 0),
        def: acc.def + (data.def || 0),
        def_max: acc.def_max + (data.def_max || 0),
      };
    }, {
      pop: 0,
      pop_max: 0,
      agri: 0,
      agri_max: 0,
      comm: 0,
      comm_max: 0,
      secu: 0,
      secu_max: 0,
      wall: 0,
      wall_max: 0,
      def: 0,
      def_max: 0,
    });

    return {
      city_count: cities.length,
      total_pop: sum.pop,
      total_pop_max: sum.pop_max,
      pop_rate: sum.pop_max > 0 ? Math.round((sum.pop / sum.pop_max) * 10000) / 100 : 0,
      agri_rate: sum.agri_max > 0 ? Math.round((sum.agri / sum.agri_max) * 10000) / 100 : 0,
      comm_rate: sum.comm_max > 0 ? Math.round((sum.comm / sum.comm_max) * 10000) / 100 : 0,
      secu_rate: sum.secu_max > 0 ? Math.round((sum.secu / sum.secu_max) * 10000) / 100 : 0,
      wall_rate: sum.wall_max > 0 ? Math.round((sum.wall / sum.wall_max) * 10000) / 100 : 0,
      def_rate: sum.def_max > 0 ? Math.round((sum.def / sum.def_max) * 10000) / 100 : 0,
    };
  }

  /**
   * 통계 정렬
   */
  private static sortStats(stats: any[], sortType: number) {
    const sortFunctions: Record<number, (a: any, b: any) => number> = {
      0: (a, b) => b.power - a.power,                    // 국력
      1: (a, b) => b.gennum - a.gennum,                  // 장수
      2: (a, b) => b.tech - a.tech,                      // 기술
      3: (a, b) => b.gold - a.gold,                      // 국고
      4: (a, b) => b.rice - a.rice,                      // 병량
      5: (a, b) => b.avg_gold - a.avg_gold,              // 평금
      6: (a, b) => b.avg_rice - a.avg_rice,              // 평쌀
      7: (a, b) => b.avg_leadership - a.avg_leadership,  // 평통
      8: (a, b) => b.avg_strength - a.avg_strength,      // 평무
      9: (a, b) => b.avg_intel - a.avg_intel,            // 평지
      10: (a, b) => b.avg_explevel - a.avg_explevel,     // 평Lv
      13: (a, b) => b.avg_dex1 - a.avg_dex1,             // 보숙
      14: (a, b) => b.avg_dex2 - a.avg_dex2,             // 궁숙
      15: (a, b) => b.avg_dex3 - a.avg_dex3,             // 기숙
      16: (a, b) => b.avg_dex4 - a.avg_dex4,             // 귀숙
      17: (a, b) => b.avg_dex5 - a.avg_dex5,             // 차숙
    };

    const sortFn = sortFunctions[sortType] || sortFunctions[0];
    return stats.sort(sortFn);
  }

  /**
   * 장수 국가 변경 (운영자 전용)
   * @param sessionId - 세션 ID
   * @param generalNo - 장수 번호
   * @param targetNationId - 대상 국가 ID (0=재야)
   */
  static async changeGeneralNation(
    sessionId: string,
    generalNo: number,
    targetNationId: number
  ) {
    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, generalNo);
      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const oldNationId = general.nation || general.data?.nation || 0;

      // 장수 국가 변경
      if (targetNationId === 0) {
        // 재야로 변경
        await generalRepository.updateBySessionAndNo(sessionId, generalNo, {
          nation: 0,
          officer_level: 0,
          officer_city: 0,
        });
      } else {
        // 국가에 소속
        await generalRepository.updateBySessionAndNo(sessionId, generalNo, {
          nation: targetNationId,
          officer_level: 1,
          officer_city: 0,
        });
      }

      // 이전 국가의 gennum 감소
      if (oldNationId > 0) {
        const oldNation = await nationRepository.findByNationNum(sessionId, oldNationId);
        if (oldNation) {
          const currentGennum = oldNation.gennum || oldNation.data?.gennum || 0;
          await nationRepository.updateByNationNum(sessionId, oldNationId, {
            gennum: Math.max(0, currentGennum - 1),
          });
        }
      }

      // 새 국가의 gennum 증가
      if (targetNationId > 0) {
        const newNation = await nationRepository.findByNationNum(sessionId, targetNationId);
        if (newNation) {
          const currentGennum = newNation.gennum || newNation.data?.gennum || 0;
          await nationRepository.updateByNationNum(sessionId, targetNationId, {
            gennum: currentGennum + 1,
          });
        }
      }

      return {
        success: true,
        message: `장수가 ${targetNationId === 0 ? '재야' : '국가'}로 이동했습니다`,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

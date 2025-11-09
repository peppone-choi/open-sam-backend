import { sessionRepository } from '../../repositories/session.repository';
import { worldHistoryRepository } from '../../repositories/world-history.repository';
import { generalRecordRepository } from '../../repositories/general-record.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { cityRepository } from '../../repositories/city.repository';

/**
 * GetCurrentHistory Service
 * 현재 턴의 역사 정보를 반환합니다
 * (맵, 전역 역사, 전역 액션, 국가 정보)
 */
export class GetCurrentHistoryService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const isFirst = data.isFirst || false;
    
    try {
      // Load session
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          success: false,
          message: 'Session not found'
        };
      }

      // Get session info
      const sessionData = session.data as any || {};
      const startYear = sessionData.startyear || 180;
      let year = sessionData.year || 180;
      let month = sessionData.month || 1;
      
      // Calculate yearMonth
      let yearMonth = year * 12 + month;
      
      if (isFirst) {
        yearMonth -= 1;
      }
      
      // Parse back to year and month
      year = Math.floor((yearMonth - 1) / 12);
      month = ((yearMonth - 1) % 12) + 1;

      // Get map (neutral view, showMe=false)
      const mapInfo = await this.getWorldMap(sessionId, null);

      // Get global history logs for this year/month
      const globalHistory = await this.getGlobalHistoryLogWithDate(sessionId, year, month);
      
      // Get global action logs for this year/month
      const globalAction = await this.getGlobalActionLogWithDate(sessionId, year, month);

      // Get all nations
      const nations = await this.getAllNations(sessionId);

      return {
        success: true,
        result: true,
        data: {
          server_id: 'sangokushi',
          year,
          month,
          map: mapInfo,
          global_history: globalHistory,
          global_action: globalAction,
          nations
        }
      };
    } catch (error: any) {
      console.error('GetCurrentHistory error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Get world map info (simplified version for history)
   */
  private static async getWorldMap(sessionId: string, userId: string | null): Promise<any> {
    const session = await sessionRepository.findBySessionId(sessionId );
    if (!session) return {};

    const sessionData = session.data as any || {};
    const startYear = sessionData.startyear || 180;
    const year = sessionData.year || 180;
    const month = sessionData.month || 1;

    // Get nations
    const nations = await nationRepository.findByFilter({ session_id: sessionId })
      
      ;

    const nationList: any[] = [];
    for (const nation of nations) {
      const nationData = nation.data as any || {};
      nationList.push([
        nation.nation,
        nation.name,
        nationData.color || '#000000',
        nationData.capital || 0
      ]);
    }

    // Get cities
    const cities = await cityRepository.findByFilter({ session_id: sessionId })
      
      ;

    const cityList: any[] = [];
    for (const city of cities) {
      cityList.push([
        city.city,
        city.level || 0,
        city.state || 0,
        city.nation || 0,
        city.region || 0,
        city.supply || 0
      ]);
    }

    return {
      startYear,
      year,
      month,
      cityList,
      nationList,
      spyList: {},
      shownByGeneralList: [],
      myCity: null,
      myNation: null,
      version: 0
    };
  }

  /**
   * Get global history logs for specific year/month
   */
  private static async getGlobalHistoryLogWithDate(sessionId: string, year: number, month: number): Promise<any[]> {
    const records = await worldHistoryRepository.findByFilter({
      session_id: sessionId,
      'data.nation_id': 0,
      'data.year': year,
      'data.month': month
    })
      
      .sort({ 'data.id': -1 })
      .limit(100)
      ;

    return records.map(record => {
      const data = record.data as any;
      return {
        id: data.id,
        text: data.text,
        year: data.year,
        month: data.month
      };
    });
  }

  /**
   * Get global action logs for specific year/month
   */
  private static async getGlobalActionLogWithDate(sessionId: string, year: number, month: number): Promise<any[]> {
    const records = await generalRecordRepository.findByFilter({
      session_id: sessionId,
      'data.general_id': 0,
      'data.log_type': 'history',
      'data.year': year,
      'data.month': month
    }, {
      sort: { 'data.id': -1 },
      limit: 100
    });

    return records.map(record => {
      const data = record.data as any;
      return {
        id: data.id,
        text: data.text,
        year: data.year,
        month: data.month
      };
    });
  }

  /**
   * Get all nations with their cities
   */
  private static async getAllNations(sessionId: string): Promise<any[]> {
    const nations = await nationRepository.findByFilter({ session_id: sessionId })
      
      ;

    const nationMap: Record<number, any> = {};
    
    for (const nation of nations) {
      const nationData = nation.data as any || {};
      nationMap[nation.nation] = {
        ...nationData,
        nation: nation.nation,
        name: nation.name,
        cities: []
      };
    }

    // Get nation 0 (neutral)
    const neutralNation = await nationRepository.findByNationNum(sessionId, 0 );
    if (neutralNation) {
      const neutralData = neutralNation.data as any || {};
      nationMap[0] = {
        ...neutralData,
        nation: 0,
        name: neutralNation.name,
        cities: []
      };
    }

    // Get all cities and add to nations
    const cities = await cityRepository.findByFilter({ session_id: sessionId })
      
      ;

    for (const city of cities) {
      const nationId = city.nation || 0;
      
      if (nationMap[nationId]) {
        nationMap[nationId].cities.push(city.name);
      }
    }

    // Convert to array and sort by power (descending)
    const nationsList = Object.values(nationMap);
    nationsList.sort((a: any, b: any) => (b.power || 0) - (a.power || 0));

    return nationsList;
  }
}

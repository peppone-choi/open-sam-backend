import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';
import { City } from '../../models/city.model';
import { Session } from '../../models/session.model';

/**
 * GetMap Service
 * 게임 맵 정보를 반환합니다 (도시, 국가, 첩보 정보 등)
 */
export class GetMapService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    const neutralView = !!(data.neutralView || false);
    const showMe = !!(data.showMe || false);
    
    try {
      // Load session
      const session = await (Session as any).findOne({ session_id: sessionId });
      if (!session) {
        return {
          success: false,
          message: 'Session not found'
        };
      }

      // Get session info (year, month, startYear)
      const sessionData = session.data as any || {};
      const startYear = sessionData.startyear || 180;
      
      // turnDate를 호출하여 최신 년/월 계산 (GetFrontInfo와 동일한 방식)
      const { ExecuteEngineService } = await import('./ExecuteEngine.service');
      const turntime = sessionData.turntime ? new Date(sessionData.turntime) : new Date();
      const gameEnvCopy = { ...sessionData };
      const turnInfo = ExecuteEngineService.turnDate(turntime, gameEnvCopy);
      
      const year = turnInfo.year;
      const month = turnInfo.month;

      // Find user's general
      let myCity: number | null = null;
      let myNation: number | null = null;
      
      if (userId) {
        const general = await (General as any).findOne({ 
          session_id: sessionId, 
          owner: userId 
        }).select('no data').lean();

        if (general && (showMe || !neutralView)) {
          const genData = general.data as any || {};
          myCity = genData.city || null;
          myNation = genData.nation || null;

          if (!showMe) {
            myCity = null;
          }
          if (neutralView) {
            myNation = null;
          }
        }
      }

      // Get spy info (첩보 정보)
      let spyInfo: Record<number, number> = {};
      
      if (myNation) {
        const nation = await (Nation as any).findOne({ 
          session_id: sessionId, 
          nation: myNation 
        }).select('data').lean();

        if (nation) {
          const nationData = nation.data as any || {};
          const rawSpy = nationData.spy || '';

          if (rawSpy) {
            // Parse spy info
            if (typeof rawSpy === 'string') {
              if (rawSpy.includes('|') || !isNaN(Number(rawSpy))) {
                // Legacy format: "cityNo*10+remainMonth|..."
                rawSpy.split('|').forEach(value => {
                  const numValue = parseInt(value);
                  const cityNo = Math.floor(numValue / 10);
                  const remainMonth = numValue % 10;
                  spyInfo[cityNo] = remainMonth;
                });
              } else {
                // JSON format
                try {
                  spyInfo = JSON.parse(rawSpy);
                } catch (e) {
                  spyInfo = {};
                }
              }
            } else if (typeof rawSpy === 'object') {
              spyInfo = rawSpy;
            }
          }
        }
      }

      // Get nation list
      const nations = await (Nation as any).find({ session_id: sessionId })
        .select('nation name color capital data')
        .lean();

      const nationList: any[] = [];
      for (const nation of nations) {
        const nationData = nation.data as any || {};
        const color = nation.color || nationData.color || '#000000';
        const capital = nation.capital ?? nationData.capital ?? 0;
        
        nationList.push([
          nation.nation,
          nation.name || nationData.name || '무명',
          color,
          capital
        ]);
      }

      // Get cities where my nation's generals are located
      let shownByGeneralList: number[] = [];
      if (myNation) {
        const generals = await (General as any).find({ 
          session_id: sessionId, 
          'data.nation': myNation 
        }).select('data').lean();

        const citySet = new Set<number>();
        for (const gen of generals) {
          const genData = gen.data as any || {};
          if (genData.city) {
            citySet.add(genData.city);
          }
        }
        shownByGeneralList = Array.from(citySet);
      }

      // Get city list
      const cities = await (City as any).find({ session_id: sessionId })
        .select('city name level state nation region supply x y data')
        .lean();

      const cityList: any[] = [];
      for (const city of cities) {
        // data 필드 폴백 (MongoDB 스키마 유연성 대응)
        const d = (city as any).data || {};
        const level = city.level ?? d.level ?? 0;
        const state = city.state ?? d.state ?? 0;
        const nation = city.nation ?? d.nation ?? 0;
        const region = city.region ?? d.region ?? 0;
        const supply = city.supply ?? d.supply ?? 0;
        const name = city.name || d.name || '';
        const x = city.x ?? d.x ?? 0;
        const y = city.y ?? d.y ?? 0;
        
        cityList.push([
          city.city,
          level,
          state,
          nation,
          region,
          supply,
          name,
          x,
          y
        ]);
      }

      // If admin (userGrade >= 5), show all cities in spy info
      // TODO: Implement user grade check when User model has grade field
      const userGrade = 0;

      if ((showMe || !neutralView) && userGrade >= 5) {
        spyInfo = {};
        for (const city of cityList) {
          spyInfo[city[0]] = 1; // city[0] is city ID
        }
      }

      return {
        success: true,
        result: true,
        startYear,
        year,
        month,
        cityList,
        nationList,
        spyList: spyInfo,
        shownByGeneralList,
        myCity,
        myNation,
        version: 0
      };
    } catch (error: any) {
      console.error('GetMap error:', error);
      return {
        success: false,
        result: false,
        message: error.message
      };
    }
  }
}

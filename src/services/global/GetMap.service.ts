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
      const session = await Session.findOne({ session_id: sessionId });
      if (!session) {
        return {
          success: false,
          message: 'Session not found'
        };
      }

      // Get session info (year, month, startYear)
      const sessionData = session.data as any || {};
      const startYear = sessionData.startyear || 180;
      const year = sessionData.year || 180;
      const month = sessionData.month || 1;

      // Find user's general
      let myCity: number | null = null;
      let myNation: number | null = null;
      
      if (userId) {
        const general = await General.findOne({ 
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
        const nation = await Nation.findOne({ 
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
      const nations = await Nation.find({ session_id: sessionId })
        .select('nation name data')
        .lean();

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

      // Get cities where my nation's generals are located
      let shownByGeneralList: number[] = [];
      if (myNation) {
        const generals = await General.find({ 
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
      const cities = await City.find({ session_id: sessionId })
        .select('city level state nation region supply')
        .lean();

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
        message: error.message
      };
    }
  }
}

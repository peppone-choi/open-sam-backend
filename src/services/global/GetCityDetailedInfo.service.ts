import { City } from '../../models/city.model';
import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';

export class GetCityDetailedInfoService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const cityId = parseInt(data.city_id) || 0;
    
    try {
      const session = await (Session as any).findOne({ session_id: sessionId });
      if (!session) {
        return {
          success: false,
          message: 'Session not found'
        };
      }

      if (!cityId) {
        return {
          success: false,
          message: 'City ID required'
        };
      }

      const city = await (City as any).findOne({ 
        session_id: sessionId, 
        city: cityId 
      }).lean();

      if (!city) {
        return {
          success: false,
          message: 'City not found'
        };
      }

      const nationId = city.nation || 0;

      const generals = await (General as any).find({
        session_id: sessionId,
        'data.city': cityId
      })
        .select('no name data')
        .lean();

      const generalList = generals.map(gen => {
        const genData = gen.data as any || {};
        return {
          no: gen.no,
          name: gen.name,
          nation: genData.nation || 0,
          officer_level: genData.officer_level || 1
        };
      });

      const cityData = city.data as any || {};

      return {
        success: true,
        result: true,
        city: {
          city: city.city,
          name: city.name,
          ...cityData
        },
        generals: generalList
      };
    } catch (error: any) {
      console.error('GetCityDetailedInfo error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

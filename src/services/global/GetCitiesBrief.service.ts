import { City } from '../../models/city.model';
import { Session } from '../../models/session.model';

export class GetCitiesBriefService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      const session = await Session.findOne({ session_id: sessionId });
      if (!session) {
        return {
          success: false,
          message: 'Session not found'
        };
      }

      const cities = await City.find({ session_id: sessionId })
        .select('city name data')
        .lean();

      const cityList: any[] = [];
      for (const city of cities) {
        const cityData = city.data as any || {};
        cityList.push({
          city: city.city,
          name: city.name,
          nation: cityData.nation || 0,
          level: cityData.level || 0,
          state: cityData.state || 0,
          region: cityData.region || 0
        });
      }

      return {
        success: true,
        result: true,
        cities: cityList
      };
    } catch (error: any) {
      console.error('GetCitiesBrief error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

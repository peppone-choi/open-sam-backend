import { City } from '../../models/city.model';
import { Session } from '../../models/session.model';

export class GetCitiesBriefService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      const session = await (Session as any).findOne({ session_id: sessionId });
      if (!session) {
        return {
          success: false,
          message: 'Session not found'
        };
      }

      const cities = await (City as any).find({ session_id: sessionId })
        .select('city name nation level state region')
        .lean();

      const cityList: any[] = [];
      for (const city of cities) {
        cityList.push({
          city: city.city,
          name: city.name,
          nation: city.nation || 0,
          level: city.level || 0,
          state: city.state || 0,
          region: city.region || 0
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

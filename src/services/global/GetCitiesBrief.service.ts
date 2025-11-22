import { cityRepository } from '../../repositories/city.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { buildCitySnapshot } from './utils/citySnapshot.util';


export class GetCitiesBriefService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          success: false,
          message: '세션을 찾을 수 없습니다.'
        };
      }

      const sessionData = (session.data as any) || {};
      const scenarioId = session.scenario_id || session.scenarioId || sessionData.scenario_id || sessionData.scenarioId || sessionData.scenarioID;

      const cities = await cityRepository.findByFilter({ session_id: sessionId })
        
        ;

      const cityList = cities.map(city => buildCitySnapshot(city, { scenarioId }));

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

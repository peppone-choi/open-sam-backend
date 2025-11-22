import { cityRepository } from '../../repositories/city.repository';
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { buildCitySnapshot } from './utils/citySnapshot.util';
import { COMMON_ERRORS } from '../../constants/messages';


export class GetCityDetailedInfoService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const cityId = parseInt(data.city_id) || 0;
    
    try {
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          success: false,
          message: COMMON_ERRORS.sessionNotFound
        };
      }

      const sessionData = (session.data as any) || {};
      const scenarioId = session.scenario_id || session.scenarioId || sessionData.scenario_id || sessionData.scenarioId || sessionData.scenarioID;

      if (!cityId) {
        return {
          success: false,
          message: COMMON_ERRORS.cityIdRequired
        };
      }

      const city = await cityRepository.findOneByFilter({ 
        session_id: sessionId, 
        city: cityId 
      });


      if (!city) {
        return {
          success: false,
          message: COMMON_ERRORS.cityNotFound
        };
      }

      const nationId = city.nation || 0;

      const generals = await generalRepository.findByFilter({
        session_id: sessionId,
        'data.city': cityId
      })
        
        ;

      const generalList = generals.map(gen => {
        const genData = gen.data as any || {};
        return {
          no: gen.no,
          name: gen.name,
          nation: genData.nation || 0,
          officer_level: genData.officer_level || 1
        };
      });

      const citySnapshot = buildCitySnapshot(city, { scenarioId });

      return {
        success: true,
        result: true,
        city: citySnapshot,
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

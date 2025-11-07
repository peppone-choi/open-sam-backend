import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { City } from '../../models/city.model';

/**
 * GetOfficerInfo Service
 * 국가의 관직자들 정보 조회
 */
export class GetOfficerInfoService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || user?.id || data.user_id;
    const generalId = user?.generalId || data.general_id;
    
    try {
      let actualGeneralId = generalId;
      
      if (!actualGeneralId) {
        if (!userId) {
          return {
            result: false,
            reason: '장수 ID 또는 사용자 정보가 필요합니다'
          };
        }
        
        // 현재 유저의 장수 조회
        const userGeneral = await generalRepository.findBySessionAndOwner({
          session_id: sessionId,
          owner: String(userId),
          'data.npc': { $lt: 2 }
        });
        
        if (!userGeneral) {
          return {
            result: false,
            reason: '장수를 찾을 수 없습니다'
          };
        }
        
        actualGeneralId = userGeneral.data?.no || userGeneral.no;
      }
      
      const general = await generalRepository.findBySessionAndNo({
        session_id: sessionId,
        'data.no': actualGeneralId
      });
      
      if (!general) {
        return {
          result: false,
          reason: '장수를 찾을 수 없습니다'
        };
      }
      
      const generalData = general.data || {};
      const nationId = generalData.nation || 0;
      actualGeneralId = generalData.no || actualGeneralId;
      
      if (nationId === 0) {
        return {
          result: false,
          reason: '국가에 소속되어 있지 않습니다'
        };
      }
      
      // 국가 정보 조회
      const nation = await nationRepository.findOneByFilter({
        session_id: sessionId,
        'data.nation': nationId
      });
      
      if (!nation) {
        return {
          result: false,
          reason: '국가를 찾을 수 없습니다'
        };
      }
      
      // 관직자 조회 (officer_level >= 2)
      const officers = await generalRepository.findByFilter({
        session_id: sessionId,
        'data.nation': nationId,
        'data.officer_level': { $gte: 2 }
      }).sort({ 'data.officer_level': -1, 'data.officer_city': 1 });
      
      // 도시별 관직자 정보 구성
      const cityOfficers: Record<number, any[]> = {};
      
      officers.forEach((officer: any) => {
        const officerData = officer.data || {};
        const officerCity = officerData.officer_city || 0;
        
        if (!cityOfficers[officerCity]) {
          cityOfficers[officerCity] = [];
        }
        
        cityOfficers[officerCity].push({
          no: officerData.no,
          name: officerData.name || '무명',
          officer_level: officerData.officer_level || 0,
          officer_city: officerCity,
          npc: officerData.npc || 0,
          leadership: officerData.leadership || 0,
          strength: officerData.strength || 0,
          intel: officerData.intel || 0
        });
      });
      
      // 도시 정보 조회
      const cities = await cityRepository.findByFilter({
        session_id: sessionId,
        'data.nation': nationId
      });
      
      const cityList = cities.map((city: any) => {
        const cityData = city.data || {};
        return {
          id: cityData.id || city.id,
          name: cityData.name || city.name || '무명',
          officers: cityOfficers[cityData.id || city.id] || []
        };
      });
      
      return {
        result: true,
        officer: {
          nation: {
            id: nationId,
            name: (nation.data || {}).name || '무명'
          },
          cities: cityList
        }
      };
    } catch (error: any) {
      return {
        result: false,
        reason: error.message || '관직자 정보 조회 중 오류가 발생했습니다'
      };
    }
  }
}


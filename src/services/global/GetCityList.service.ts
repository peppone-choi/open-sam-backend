import { cityRepository } from '../../repositories/city.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { sessionRepository } from '../../repositories/session.repository';

/**
 * GetCityList Service
 * 도시 목록 조회 (PHP: j_get_city_list.php)
 * 국가별로 그룹화된 도시 정보 반환
 */
export class GetCityListService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      // 세션 확인
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          result: false,
          reason: '세션을 찾을 수 없습니다'
        };
      }

      // 국가 정보 조회
      const nations = await nationRepository.findByFilter({ session_id: sessionId })
        
        ;

      const nationMap: Record<number, any> = {};
      for (const nation of nations) {
        nationMap[nation.nation] = {
          nation: nation.nation,
          name: nation.name || '무명',
          color: nation.color || '#000000'
        };
      }

      // 도시 목록 조회
      const cities = await cityRepository.findByFilter({ session_id: sessionId })
        
        ;

      const cityArgsList = ['city', 'nation', 'name', 'level'];
      const cityList = cities.map((city: any) => [
        city.city,
        city.nation || 0,
        city.name || `도시 ${city.city}`,
        city.level || 1
      ]);

      return {
        result: true,
        nations: nationMap,
        cityArgsList,
        cities: cityList
      };
    } catch (error: any) {
      console.error('GetCityList error:', error);
      return {
        result: false,
        reason: error.message || '도시 목록 조회 실패'
      };
    }
  }
}


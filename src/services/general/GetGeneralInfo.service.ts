import { generalRepository } from '../../repositories/general.repository';
import { cityRepository } from '../../repositories/city.repository';
import { nationRepository } from '../../repositories/nation.repository';

/**
 * GetGeneralInfo Service
 * 장수 상세 정보 조회
 */
export class GetGeneralInfoService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    
    if (!generalId) {
      return {
        success: false,
        message: '장수 ID가 필요합니다'
      };
    }

    try {
      // 장수 정보 조회
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);

      if (!general) {
        return {
          success: false,
          message: '장수를 찾을 수 없습니다'
        };
      }

      // 소속 도시 정보
      const cityId = general.data?.city;
      const city = cityId ? await cityRepository.findOneByFilter({
        session_id: sessionId,
        'data.id': cityId
      }) : null;

      // 소속 국가 정보
      const nationId = general.data?.nation;
      const nation = nationId && nationId !== 0 ? await nationRepository.findOneByFilter({
        session_id: sessionId,
        'data.nation': nationId
      }) : null;

      return {
        success: true,
        result: true,
        general: general.data,
        city: city?.data || null,
        nation: nation?.data || null
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

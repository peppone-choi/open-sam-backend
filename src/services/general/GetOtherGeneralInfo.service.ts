import { generalRepository } from '../../repositories/general.repository';
import { cityRepository } from '../../repositories/city.repository';
import { nationRepository } from '../../repositories/nation.repository';

/**
 * GetOtherGeneralInfo Service
 * 다른 장수의 공개 정보 조회 (제한된 정보만)
 */
export class GetOtherGeneralInfoService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const targetGeneralId = data.target_general_id;
    
    if (!targetGeneralId) {
      return {
        success: false,
        message: '대상 장수 ID가 필요합니다'
      };
    }

    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, targetGeneralId);

      if (!general) {
        return {
          success: false,
          message: '장수를 찾을 수 없습니다'
        };
      }

      // 공개 정보만 반환 (민감한 정보 제외)
      const publicInfo = {
        no: general.data?.no,
        name: general.data?.name,
        npc: general.data?.npc,
        nation: general.data?.nation,
        city: general.data?.city,
        officer_level: general.data?.officer_level,
        leadership: general.data?.leadership,
        strength: general.data?.strength,
        intel: general.data?.intel,
        experience: general.data?.experience,
        dedication: general.data?.dedication,
         crew: general.data?.crew,
         crewtype: (() => {
           let crewtype = general.data?.crewtype ?? 0;
           const crew = general.data?.crew || 0;
           const resultTurn = general.data?.result_turn;
           const cmd = resultTurn?.command;
           const argCrewType = resultTurn?.arg?.crewType;

           if (!crewtype && crew > 0 && argCrewType &&
             ['징병', '모병', 'che_징병', 'che_모병', 'conscript', 'recruitSoldiers'].includes(cmd)) {
             crewtype = argCrewType;
           }
           return crewtype;
         })(),
         atmos: general.data?.atmos,

        train: general.data?.train,
        // 금, 쌀, 아이템 등 민감한 정보는 제외
      };

      // 소속 도시/국가 정보
      const cityId = general.data?.city;
      const city = cityId ? await cityRepository.findOneByFilter({
        session_id: sessionId,
        'data.id': cityId
      }) : null;

      const nationId = general.data?.nation;
      const nation = nationId && nationId !== 0 ? await nationRepository.findOneByFilter({
        session_id: sessionId,
        'data.nation': nationId
      }) : null;

      return {
        success: true,
        result: true,
        general: publicInfo,
        city: city ? { name: city.data?.name, level: city.data?.level } : null,
        nation: nation ? { name: nation.data?.name, color: nation.data?.color } : null
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

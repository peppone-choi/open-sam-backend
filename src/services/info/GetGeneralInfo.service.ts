// @ts-nocheck - Argument count mismatches need review
import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { City } from '../../models/city.model';
import { Troop } from '../../models/troop.model';
import { cityRepository } from '../../repositories/city.repository';
import { troopRepository } from '../../repositories/troop.repository';

/**
 * GetGeneralInfo Service
 * 특정 장수 또는 현재 유저의 장수 정보 조회
 * PHP: /sam/hwe/sammo/API/General/GetFrontInfo.php의 general 부분 참고
 */
export class GetGeneralInfoService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || user?.id || data.user_id;
    const requestedGeneralId = data.generalID || data.general_id || data.generalId;
    
    try {
      let generalId = requestedGeneralId;
      let general;
      
      // generalID가 지정되지 않으면 현재 유저의 장수 조회
      if (!generalId) {
        if (!userId) {
          return {
            result: false,
            reason: '장수 ID 또는 사용자 정보가 필요합니다'
          };
        }
        
        // 현재 유저의 장수 조회
        general = await generalRepository.findBySessionAndOwner(
          sessionId,
          String(userId),
          { npc: { $lt: 2 } } // NPC가 아닌 실제 플레이어 장수
        );
        
        if (!general) {
          return {
            result: false,
            reason: '장수를 찾을 수 없습니다'
          };
        }
        
        generalId = general.data?.no || general.no;
      } else {
        // 지정된 generalID로 조회
        general = await generalRepository.findBySessionAndNo(sessionId, generalId);
        
        if (!general) {
          return {
            result: false,
            reason: '장수를 찾을 수 없습니다'
          };
        }
      }
      
      // data 필드 또는 최상위 필드에서 값 가져오기
      const generalData = general.data || general;
      const nationId = generalData.nation || general.nation || 0;
      const cityId = generalData.city || general.city || 0;
      
      // 국가 정보 조회
      let nationInfo = null;
      if (nationId !== 0) {
        const nationDoc = await nationRepository.findByNationNum(sessionId, nationId);
        if (nationDoc) {
          const nation: any = typeof (nationDoc as any).toObject === 'function' ? (nationDoc as any).toObject() : nationDoc;
          const nationData = nation.data || nation;
          nationInfo = {
            id: nationId,
            name: nationData.name || '무명',
            color: nationData.color || '#000000',
            level: nationData.level || 0,
          };
        }
      }
      
      // 도시 정보 조회
      let cityInfo = null;
      if (cityId !== 0) {
        const cityDoc = await cityRepository.findByCityNum(sessionId, cityId);
        if (cityDoc) {
          const city: any = typeof (cityDoc as any).toObject === 'function' ? (cityDoc as any).toObject() : cityDoc;
          const cityData = city.data || city;
          cityInfo = {
            id: cityId,
            name: cityData.name || '무명',
            x: cityData.x || 0,
            y: cityData.y || 0,
          };
        }
      }
      
      // 부대 정보 조회
      let troopInfo = null;
      if (generalData.troop) {
        const troop = await troopRepository.findOneByFilter({
          session_id: sessionId,
          'data.troop_leader': generalData.troop,
        });
        
        if (troop) {
          const troopData = troop.data || {};
          troopInfo = {
            troop: generalData.troop,
            name: troopData.name || '무명 부대',
            leader: troopData.troop_leader || generalData.troop || 0,
          };
        }
      }
      
      const officerLevel = generalData.officer_level || 0;
      const officerLevelText = this.getOfficerLevelText(officerLevel, nationInfo?.level || 0);
      
      // 장수 정보 구성
      const generalInfo = {
        no: generalId,
        name: generalData.name || '무명',
        npc: generalData.npc || 0,
        leadership: generalData.leadership || 0,
        strength: generalData.strength || 0,
        intel: generalData.intel || 0,
        leadership_exp: generalData.leadership_exp || 0,
        strength_exp: generalData.strength_exp || 0,
        intel_exp: generalData.intel_exp || 0,
        officer_level: officerLevel,
        officerLevel: officerLevel,
        officerLevelText,
        officer_city: generalData.officer_city || 0,
        city: cityId,
        nation: nationId,
        gold: generalData.gold || 0,
        rice: generalData.rice || 0,
        crew: generalData.crew || 0,
        crewtype: (() => {
          let crewtype = generalData.crewtype ?? 0;
          const crew = generalData.crew || 0;
          const resultTurn = generalData.result_turn;
          const cmd = resultTurn?.command;
          const argCrewType = resultTurn?.arg?.crewType;

          if (!crewtype && crew > 0 && argCrewType &&
            ['징병', '모병', 'che_징병', 'che_모병', 'conscript', 'recruitSoldiers'].includes(cmd)) {
            crewtype = argCrewType;
          }
          return crewtype;
        })(),
        train: generalData.train || 0,
        atmos: generalData.atmos || 0,
        injury: generalData.injury || 0,
        experience: generalData.experience || 0,
        explevel: generalData.explevel || 0,
        age: generalData.age || 0,
        killturn: generalData.killturn || 0,
        horse: generalData.horse || '',
        weapon: generalData.weapon || '',
        book: generalData.book || '',
        item: generalData.item || '',
        personal: generalData.personal || '',
        specialDomestic: generalData.special || generalData.special_domestic || '',
        specialWar: generalData.special2 || generalData.special_war || '',
        troop: generalData.troop || 0,
        nationInfo,
        cityInfo,
        troopInfo,
      };
      
      return {
        result: true,
        general: generalInfo,
      };
    } catch (error: any) {
      // 시스템 오류는 라우터에서 5xx로 처리할 수 있도록 그대로 throw
      throw error;
    }
  }

  private static getOfficerLevelText(officerLevel: number, nationLevel: number = 0): string {
    const { getOfficerTitle } = require('../../utils/rank-system');
    return getOfficerTitle(officerLevel, nationLevel);
  }
}




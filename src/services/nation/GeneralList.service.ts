import { generalRepository } from '../../repositories/general.repository';
import { troopRepository } from '../../repositories/troop.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { sessionRepository } from '../../repositories/session.repository';

/**
 * GeneralList Service
 * 국가 소속 장수 목록 조회
 * PHP: /sam/hwe/sammo/API/Nation/GeneralList.php
 */
export class GeneralListService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const type = data.type || 7;
    
    try {
      // 사용자 ID로 장수 찾기
      const userId = user?.userId || user?.id;
      if (!userId) {
        return { success: false, message: '로그인이 필요합니다' };
      }

      const general = await generalRepository.findOneByFilter({ 
        session_id: sessionId,
        owner: String(userId) 
      });

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }
      
      const generalId = general.data?.no || general.no;

      const nationId = general.data?.nation || 0;
      const officerLevel = general.data?.officer_level || 0;
      const permission = general.data?.permission || 'normal';
      const penalty = general.data?.penalty || 0;

      if (nationId === 0) {
        return { success: false, message: '국가에 소속되어 있지 않습니다' };
      }

      const session = await sessionRepository.findBySessionId(sessionId);
      const sessionData = session?.data || {};

      const permission_level = this.checkSecretPermission(officerLevel, permission, penalty, sessionData);

      const nation = await nationRepository.findByNationNum(sessionId, nationId);

      if (!nation) {
        return { success: false, message: '국가를 찾을 수 없습니다' };
      }

      const generalList = await generalRepository.findByNation(sessionId, nationId);
      
      console.log(`[GeneralList] Found ${generalList.length} generals for nation ${nationId}`);
      if (generalList.length > 0) {
        console.log(`[GeneralList] Sample general:`, {
          no: generalList[0].no,
          name: generalList[0].name || generalList[0].data?.name,
          nation: generalList[0].nation || generalList[0].data?.nation,
          city: generalList[0].city || generalList[0].data?.city
        });
      }

      const troops = await troopRepository.findByNation(sessionId, nationId);

      const troopMap: Record<number, any> = {};
      troops.forEach(troop => {
        const troopLeader = troop.data?.troop_leader;
        if (troopLeader) {
          troopMap[troopLeader] = {
            id: troopLeader,
            name: troop.data?.name || '무명부대',
            turntime: troop.data?.turntime,
            reservedCommand: []
          };
        }
      });

      let formattedGenerals = generalList.map(gen => {
        const genData = gen.data || {};
        const troopInfo = troopMap[genData.no];
        return {
          no: genData.no,
          name: genData.name || '무명',
          nation: genData.nation,
          npc: genData.npc || 0,
          injury: genData.injury || 0,
          leadership: genData.leadership || 0,
          strength: genData.strength || 0,
          intel: genData.intel || 0,
          experience: genData.experience || 0,
          explevel: genData.explevel || 0,
          dedlevel: genData.dedlevel || 0,
          gold: genData.gold || 0,
          rice: genData.rice || 0,
          picture: genData.picture,
          imgsvr: genData.imgsvr,
          age: genData.age,
          special: genData.special,
          special2: genData.special2,
          personal: genData.personal,
          belong: genData.belong,
          troop: genData.troop,
          troopName: troopInfo?.name || '-',
          city: genData.city,
          cityName: genData.city,
          crewtype: genData.crewtype || 0,
          officer_level: permission_level >= 1 ? genData.officer_level : (genData.officer_level >= 5 ? genData.officer_level : 1),
          killturn: genData.killturn || 0,
          turntime: genData.turntime,
          crew: genData.crew || 0,
          train: genData.train || 0,
          atmos: genData.atmos || 0
        };
      });

      // 정렬
      formattedGenerals = this.sortGenerals(formattedGenerals, type);

      return {
        success: true,
        result: true,
        permission: permission_level,
        list: formattedGenerals,
        generalList: formattedGenerals,
        troops: Object.values(troopMap),
        env: {
          year: sessionData.year,
          month: sessionData.month,
          turntime: sessionData.turntime,
          turnterm: sessionData.turnterm
        },
        myGeneralID: generalId
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  private static sortGenerals(generals: any[], type: number): any[] {
    const sorted = [...generals];
    switch (type) {
      case 1: // 자금
        sorted.sort((a, b) => (b.gold || 0) - (a.gold || 0));
        break;
      case 2: // 군량
        sorted.sort((a, b) => (b.rice || 0) - (a.rice || 0));
        break;
      case 3: // 도시
        sorted.sort((a, b) => String(a.city).localeCompare(String(b.city)));
        break;
      case 4: // 병종
        sorted.sort((a, b) => (b.crewtype || 0) - (a.crewtype || 0));
        break;
      case 5: // 병사
        sorted.sort((a, b) => (b.crew || 0) - (a.crew || 0));
        break;
      case 6: // 삭제턴
        sorted.sort((a, b) => (a.killturn || 0) - (b.killturn || 0));
        break;
      case 7: // 턴
        sorted.sort((a, b) => {
          const timeA = a.turntime ? new Date(a.turntime).getTime() : 0;
          const timeB = b.turntime ? new Date(b.turntime).getTime() : 0;
          return timeA - timeB;
        });
        break;
      case 8: // 부대
        sorted.sort((a, b) => (b.troop || 0) - (a.troop || 0));
        break;
      case 9: // 통솔
        sorted.sort((a, b) => (b.leadership || 0) - (a.leadership || 0));
        break;
      case 10: // 무력
        sorted.sort((a, b) => (b.strength || 0) - (a.strength || 0));
        break;
      case 11: // 지력
        sorted.sort((a, b) => (b.intel || 0) - (a.intel || 0));
        break;
      case 12: // 정치
        sorted.sort((a, b) => (b.experience || 0) - (a.experience || 0));
        break;
      case 13: // 매력
        sorted.sort((a, b) => (b.dedlevel || 0) - (a.dedlevel || 0));
        break;
      case 14: // 훈련
        sorted.sort((a, b) => (b.train || 0) - (a.train || 0));
        break;
      case 15: // 사기
        sorted.sort((a, b) => (b.atmos || 0) - (a.atmos || 0));
        break;
      default:
        sorted.sort((a, b) => {
          const timeA = a.turntime ? new Date(a.turntime).getTime() : 0;
          const timeB = b.turntime ? new Date(b.turntime).getTime() : 0;
          return timeA - timeB;
        });
    }
    return sorted;
  }

  private static checkSecretPermission(officerLevel: number, permission: string, penalty: number, sessionData: any): number {
    if (officerLevel >= 5) return 2;
    if (permission === 'ambassador') return 4;
    if (permission === 'auditor') return 3;
    if (penalty > 0) return -1;
    
    const secretLimit = sessionData.secretlimit || 0;
    const dedication = sessionData.dedication || 0;
    
    if (dedication >= secretLimit) return 1;
    return 0;
  }
}

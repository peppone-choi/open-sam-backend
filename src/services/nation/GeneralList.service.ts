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
    const generalId = user?.generalId || data.general_id;
    
    try {
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

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

      const formattedGenerals = generalList.map(gen => {
        const genData = gen.data || {};
        return {
          no: genData.no,
          name: genData.name || '무명',
          nation: genData.nation,
          npc: genData.npc || 0,
          injury: genData.injury || 0,
          leadership: genData.leadership || 0,
          strength: genData.strength || 0,
          intel: genData.intel || 0,
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
          city: genData.city,
          officer_level: permission_level >= 1 ? genData.officer_level : (genData.officer_level >= 5 ? genData.officer_level : 1),
          turntime: genData.turntime,
          crew: genData.crew,
          train: genData.train,
          atmos: genData.atmos
        };
      });

      return {
        success: true,
        result: true,
        permission: permission_level,
        list: formattedGenerals,
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

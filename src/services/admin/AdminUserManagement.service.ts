import { generalRepository } from '../../repositories/general.repository';
import { userRepository } from '../../repositories/user.repository';
import { SendSystemNoticeService } from '../message/SendSystemNotice.service';

/**
 * AdminUserManagement Service
 * 운영자 회원 관리 (PHP: _admin2.php)
 * 
 * 기능:
 * - 전체 접속 허용/제한
 * - 개별 블럭 (1/2/3단계, 무한삭턴)
 * - 강제 사망
 * - 병종 숙련도 부여
 * - 하야 / 방랑군 해산
 * - 개인 메시지 전달
 */
export class AdminUserManagementService {
  /**
   * 장수 목록 조회 (세션별)
   */
  static async getGeneralList(sessionId: string, options?: {
    nationId?: number;
    npcFilter?: number;
    limit?: number;
  }) {
    try {
      const filter: any = { session_id: sessionId };
      
      if (options?.nationId !== undefined) {
        filter.nation = options.nationId;
      }
      
      if (options?.npcFilter !== undefined) {
        filter.npc = options.npcFilter;
      }

      const generals = await generalRepository.findByFilter(filter);
      const limit = options?.limit || 100;

      return {
        success: true,
        generals: generals.slice(0, limit).map((g: any) => ({
          no: g.no,
          name: g.name,
          nation: g.nation || 0,
          npc: g.npc || 0,
          owner: g.owner,
          owner_name: g.owner_name,
          leadership: g.leadership,
          strength: g.strength,
          intel: g.intel,
          gold: g.gold,
          rice: g.rice,
          crew: g.crew,
          crewtype: g.crewtype,
          penalty: g.penalty || 0,
          killturn: g.killturn || 0,
        })),
        total: generals.length,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 장수 블럭 설정
   * penalty: 0=정상, 1=1단계 블럭, 2=2단계, 3=3단계, 999=무한삭턴
   */
  static async setGeneralBlock(sessionId: string, generalNo: number, penaltyLevel: number) {
    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, generalNo);
      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      await generalRepository.updateBySessionAndNo(sessionId, generalNo, {
        penalty: penaltyLevel,
      });

      const levelText = penaltyLevel === 0 ? '블럭 해제' :
                       penaltyLevel === 999 ? '무한삭턴' :
                       `${penaltyLevel}단계 블럭`;

      return {
        success: true,
        message: `${general.name}(${generalNo})에게 ${levelText} 적용`,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 장수 강제 사망
   */
  static async forceGeneralDeath(sessionId: string, generalNo: number) {
    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, generalNo);
      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      await generalRepository.updateBySessionAndNo(sessionId, generalNo, {
        npc: 5, // NPC 5 = 사망
        killturn: 0,
      });

      return {
        success: true,
        message: `${general.name}(${generalNo})가 강제 사망 처리되었습니다`,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 병종 숙련도 부여
   * crewType: 0=보병, 1=궁병, 2=기병, 3=귀병, 4=차병
   */
  static async grantCrewSkill(sessionId: string, generalNo: number, crewType: number, amount: number = 10000) {
    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, generalNo);
      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const crewTypeNames = ['보병', '궁병', '기병', '귀병', '차병'];
      const dexField = `dex${crewType + 1}`; // dex1~dex5

      const updateData: any = {};
      updateData[dexField] = (general[dexField] || 0) + amount;

      await generalRepository.updateBySessionAndNo(sessionId, generalNo, updateData);

      return {
        success: true,
        message: `${general.name}에게 ${crewTypeNames[crewType]} 숙련도 ${amount} 부여`,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 장수 하야 (군주만 가능)
   */
  static async abdicate(sessionId: string, generalNo: number) {
    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, generalNo);
      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      if (general.officer_level !== 12) {
        return { success: false, message: '군주만 하야할 수 있습니다' };
      }

      await generalRepository.updateBySessionAndNo(sessionId, generalNo, {
        officer_level: 1,
        nation: 0, // 재야로
        city: 0,
      });

      return {
        success: true,
        message: `${general.name}이 하야하여 재야가 되었습니다`,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 방랑군 해산
   */
  static async dismissWanderer(sessionId: string, generalNo: number) {
    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, generalNo);
      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      if (general.nation !== 0) {
        return { success: false, message: '재야 장수만 해산할 수 있습니다' };
      }

      await generalRepository.updateBySessionAndNo(sessionId, generalNo, {
        crew: 0,
        crewtype: 0,
      });

      return {
        success: true,
        message: `${general.name}의 방랑군이 해산되었습니다`,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 개인 메시지 전달
   */
  static async sendMessageToGeneral(sessionId: string, generalNo: number, text: string) {
    return await SendSystemNoticeService.sendToGeneral(sessionId, generalNo, text);
  }

  /**
   * 전체 접속 허용/제한
   */
  static async setAllGeneralsAccess(sessionId: string, allow: boolean) {
    try {
      const generals = await generalRepository.findByFilter({
        session_id: sessionId,
        npc: { $lt: 2 }, // NPC가 아닌 장수만
      });

      const penaltyLevel = allow ? 0 : 1;

      for (const general of generals) {
        await generalRepository.updateBySessionAndNo(sessionId, general.no, {
          penalty: penaltyLevel,
        });
      }

      return {
        success: true,
        message: `전체 장수 ${generals.length}명이 ${allow ? '접속 허용' : '접속 제한'} 처리되었습니다`,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 접속 허용/제한 (개별)
   */
  static async setGeneralAccess(sessionId: string, generalNo: number, allow: boolean) {
    return await this.setGeneralBlock(sessionId, generalNo, allow ? 0 : 1);
  }

  /**
   * 장수 통계 조회
   */
  static async getGeneralStats(sessionId: string) {
    try {
      const generals = await generalRepository.findByFilter({ session_id: sessionId });
      
      const stats = {
        total: generals.length,
        byNation: {} as Record<number, number>,
        byNPC: {
          user: generals.filter((g: any) => (g.npc || 0) === 0).length,
          npc: generals.filter((g: any) => (g.npc || 0) >= 2 && (g.npc || 0) < 5).length,
          dead: generals.filter((g: any) => (g.npc || 0) === 5).length,
        },
        blocked: generals.filter((g: any) => (g.penalty || 0) > 0).length,
      };

      generals.forEach((g: any) => {
        const nation = g.nation || 0;
        stats.byNation[nation] = (stats.byNation[nation] || 0) + 1;
      });

      return {
        success: true,
        stats,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

import { generalRepository } from '../../repositories/general.repository';
import { userRepository } from '../../repositories/user.repository';
import { SendSystemNoticeService } from '../message/SendSystemNotice.service';
import { GameEventEmitter } from '../gameEventEmitter';

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

      const generalName = general.name || '무명';
      const nationId = general.nation || 0;

      await generalRepository.updateBySessionAndNo(sessionId, generalNo, {
        npc: 5, // NPC 5 = 사망
        killturn: 0,
      });

      // 장수 사망 이벤트 브로드캐스트
      GameEventEmitter.broadcastGeneralDied(
        sessionId,
        generalNo,
        generalName,
        nationId,
        'admin'
      );

      return {
        success: true,
        message: `${generalName}(${generalNo})가 강제 사망 처리되었습니다`,
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

  // =====================================================
  // 일괄 처리 기능 (PHP _admin2_submit.php 대응)
  // =====================================================

  /**
   * 일괄 블럭 설정
   * @param genlist 장수 ID 배열
   * @param penaltyLevel 0=해제, 1=1단계, 2=2단계, 3=3단계, 999=무한삭턴
   */
  static async batchSetBlock(sessionId: string, genlist: number[], penaltyLevel: number) {
    try {
      if (!genlist || genlist.length === 0) {
        return { success: false, message: '장수 목록이 필요합니다' };
      }

      const updateData: any = { 'data.block': penaltyLevel };
      
      // 블럭 레벨에 따른 추가 처리
      if (penaltyLevel >= 1) {
        updateData['data.killturn'] = 24;
      }
      if (penaltyLevel >= 2) {
        updateData['data.gold'] = 0;
        updateData['data.rice'] = 0;
      }

      await generalRepository.updateManyByFilter(
        { session_id: sessionId, 'data.no': { $in: genlist } },
        updateData
      );

      const levelText = penaltyLevel === 0 ? '블럭 해제' :
                       penaltyLevel === 999 ? '무한삭턴' :
                       `${penaltyLevel}단계 블럭`;

      return {
        success: true,
        message: `${genlist.length}명의 장수에게 ${levelText} 적용`,
        processed: genlist.length
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 일괄 강제 사망
   */
  static async batchForceDeath(sessionId: string, genlist: number[]) {
    try {
      if (!genlist || genlist.length === 0) {
        return { success: false, message: '장수 목록이 필요합니다' };
      }

      const now = new Date();
      
      // 장수 상태 업데이트
      await generalRepository.updateManyByFilter(
        { session_id: sessionId, 'data.no': { $in: genlist } },
        { 'data.killturn': 0, 'data.turntime': now }
      );

      // 턴 명령을 휴식으로 변경
      const { GeneralTurn } = await import('../../models/general_turn.model');
      await GeneralTurn.updateMany(
        { session_id: sessionId, general_id: { $in: genlist }, turn_idx: 0 },
        { $set: { action: '휴식', arg: '{}', brief: '휴식' } }
      );

      return {
        success: true,
        message: `${genlist.length}명의 장수가 강제 사망 처리되었습니다`,
        processed: genlist.length
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 일괄 숙련도 부여
   * dexType: 1=보병, 2=궁병, 3=기병, 4=귀병, 5=차병
   */
  static async batchGrantDex(sessionId: string, genlist: number[], dexType: number, amount: number = 10000) {
    try {
      if (!genlist || genlist.length === 0) {
        return { success: false, message: '장수 목록이 필요합니다' };
      }

      const dexField = `data.dex${dexType}`;
      const dexNames = ['', '보병', '궁병', '기병', '귀병', '차병'];

      // $inc 연산을 사용하여 숙련도 증가
      const { General } = await import('../../models/general.model');
      await General.updateMany(
        { session_id: sessionId, 'data.no': { $in: genlist } },
        { $inc: { [dexField]: amount } }
      );

      // 메시지 전송
      const text = `${dexNames[dexType]}숙련도+${amount} 지급!`;
      for (const generalNo of genlist) {
        await SendSystemNoticeService.sendToGeneral(sessionId, generalNo, text);
      }

      return {
        success: true,
        message: `${genlist.length}명에게 ${dexNames[dexType]}숙련도 ${amount} 부여`,
        processed: genlist.length
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 일괄 경험치 부여
   */
  static async batchGrantExperience(sessionId: string, genlist: number[], amount: number = 1000) {
    try {
      if (!genlist || genlist.length === 0) {
        return { success: false, message: '장수 목록이 필요합니다' };
      }

      const { General } = await import('../../models/general.model');
      await General.updateMany(
        { session_id: sessionId, 'data.no': { $in: genlist } },
        { $inc: { 'data.experience': amount } }
      );

      const text = `경험치+${amount} 지급!`;
      for (const generalNo of genlist) {
        await SendSystemNoticeService.sendToGeneral(sessionId, generalNo, text);
      }

      return {
        success: true,
        message: `${genlist.length}명에게 경험치 ${amount} 부여`,
        processed: genlist.length
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 일괄 공헌치 부여
   */
  static async batchGrantDedication(sessionId: string, genlist: number[], amount: number = 1000) {
    try {
      if (!genlist || genlist.length === 0) {
        return { success: false, message: '장수 목록이 필요합니다' };
      }

      const { General } = await import('../../models/general.model');
      await General.updateMany(
        { session_id: sessionId, 'data.no': { $in: genlist } },
        { $inc: { 'data.dedication': amount } }
      );

      const text = `공헌치+${amount} 지급!`;
      for (const generalNo of genlist) {
        await SendSystemNoticeService.sendToGeneral(sessionId, generalNo, text);
      }

      return {
        success: true,
        message: `${genlist.length}명에게 공헌치 ${amount} 부여`,
        processed: genlist.length
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 일괄 접속 허용/제한
   */
  static async batchSetAccess(sessionId: string, genlist: number[], allow: boolean) {
    try {
      if (!genlist || genlist.length === 0) {
        return { success: false, message: '장수 목록이 필요합니다' };
      }

      const { GeneralAccessLog } = await import('../../models/general_access_log.model');
      await GeneralAccessLog.updateMany(
        { session_id: sessionId, general_id: { $in: genlist } },
        { $set: { refresh_score: allow ? 0 : 1000 } }
      );

      return {
        success: true,
        message: `${genlist.length}명이 ${allow ? '접속 허용' : '접속 제한'} 처리되었습니다`,
        processed: genlist.length
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 일괄 메시지 전달
   */
  static async batchSendMessage(sessionId: string, genlist: number[], text: string) {
    try {
      if (!genlist || genlist.length === 0) {
        return { success: false, message: '장수 목록이 필요합니다' };
      }

      if (!text || text.trim() === '') {
        return { success: false, message: '메시지 내용이 필요합니다' };
      }

      for (const generalNo of genlist) {
        await SendSystemNoticeService.sendToGeneral(sessionId, generalNo, text);
      }

      return {
        success: true,
        message: `${genlist.length}명에게 메시지 전달 완료`,
        processed: genlist.length
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 일괄 하야 입력 (턴 명령을 하야로 설정)
   */
  static async batchSetAbdicate(sessionId: string, genlist: number[]) {
    try {
      if (!genlist || genlist.length === 0) {
        return { success: false, message: '장수 목록이 필요합니다' };
      }

      const { GeneralTurn } = await import('../../models/general_turn.model');
      await GeneralTurn.updateMany(
        { session_id: sessionId, general_id: { $in: genlist }, turn_idx: 0 },
        { $set: { action: 'che_하야', arg: '{}', brief: '하야' } }
      );

      return {
        success: true,
        message: `${genlist.length}명에게 하야 명령 입력`,
        processed: genlist.length
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 일괄 방랑군 해산 (방랑 + 해산 명령 설정)
   */
  static async batchSetDisband(sessionId: string, genlist: number[]) {
    try {
      if (!genlist || genlist.length === 0) {
        return { success: false, message: '장수 목록이 필요합니다' };
      }

      const { GeneralTurn } = await import('../../models/general_turn.model');
      
      // 첫 번째 턴: 방랑
      await GeneralTurn.updateMany(
        { session_id: sessionId, general_id: { $in: genlist }, turn_idx: 0 },
        { $set: { action: 'che_방랑', arg: '{}', brief: '방랑' } }
      );
      
      // 두 번째 턴: 해산
      await GeneralTurn.updateMany(
        { session_id: sessionId, general_id: { $in: genlist }, turn_idx: 1 },
        { $set: { action: 'che_해산', arg: '{}', brief: '해산' } }
      );

      return {
        success: true,
        message: `${genlist.length}명에게 방랑+해산 명령 입력`,
        processed: genlist.length
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 일괄 처리 통합 메서드 (PHP _admin2_submit.php 대응)
   * @param btn 버튼 이름 (액션)
   * @param genlist 장수 ID 배열
   * @param msg 메시지 (옵션)
   */
  static async executeBatchAction(sessionId: string, btn: string, genlist: number[], msg?: string) {
    switch (btn) {
      case '전체 접속허용':
        return this.setAllGeneralsAccess(sessionId, true);
      case '전체 접속제한':
        return this.setAllGeneralsAccess(sessionId, false);
      case '블럭 해제':
        return this.batchSetBlock(sessionId, genlist, 0);
      case '1단계 블럭':
        return this.batchSetBlock(sessionId, genlist, 1);
      case '2단계 블럭':
        return this.batchSetBlock(sessionId, genlist, 2);
      case '3단계 블럭':
        return this.batchSetBlock(sessionId, genlist, 3);
      case '무한삭턴':
        return this.batchSetBlock(sessionId, genlist, 999);
      case '강제 사망':
        return this.batchForceDeath(sessionId, genlist);
      case '보숙10000':
        return this.batchGrantDex(sessionId, genlist, 1, 10000);
      case '궁숙10000':
        return this.batchGrantDex(sessionId, genlist, 2, 10000);
      case '기숙10000':
        return this.batchGrantDex(sessionId, genlist, 3, 10000);
      case '귀숙10000':
        return this.batchGrantDex(sessionId, genlist, 4, 10000);
      case '차숙10000':
        return this.batchGrantDex(sessionId, genlist, 5, 10000);
      case '경험치1000':
        return this.batchGrantExperience(sessionId, genlist, 1000);
      case '공헌치1000':
        return this.batchGrantDedication(sessionId, genlist, 1000);
      case '접속 허용':
        return this.batchSetAccess(sessionId, genlist, true);
      case '접속 제한':
        return this.batchSetAccess(sessionId, genlist, false);
      case '메세지 전달':
        return this.batchSendMessage(sessionId, genlist, msg || '');
      case '하야입력':
        return this.batchSetAbdicate(sessionId, genlist);
      case '방랑해산':
        return this.batchSetDisband(sessionId, genlist);
      default:
        return { success: false, message: `알 수 없는 명령: ${btn}` };
    }
  }
}

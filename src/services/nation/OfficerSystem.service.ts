/**
 * OfficerSystemService
 * 관직 권한 시스템
 * 
 * 기능:
 * - 관직별 권한 정의
 * - 임명/해임 처리
 * - 권한 체크
 * - 관직 제한 관리
 */

import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { cityRepository } from '../../repositories/city.repository';
import { getNationLevelInfo, getOfficerTitle } from '../../utils/rank-system';

/**
 * 관직 레벨 정의
 * 
 * 0: 재야/방랑
 * 1: 병졸 (최하급)
 * 2~4: 지방관 (태수, 군수 등)
 * 5~11: 수뇌부
 * 12: 군주/황제
 */
export enum OfficerLevel {
  WANDERER = 0,     // 재야
  SOLDIER = 1,      // 병졸
  OFFICER_2 = 2,    // 지방관 (현령)
  OFFICER_3 = 3,    // 지방관 (군수)
  OFFICER_4 = 4,    // 지방관 (태수)
  CHIEF_5 = 5,      // 수뇌부 (중랑장)
  CHIEF_6 = 6,      // 수뇌부
  CHIEF_7 = 7,      // 수뇌부
  CHIEF_8 = 8,      // 수뇌부
  CHIEF_9 = 9,      // 수뇌부
  CHIEF_10 = 10,    // 수뇌부
  CHIEF_11 = 11,    // 수뇌부 (부군주)
  KING = 12,        // 군주
}

/**
 * 권한 종류
 */
export enum Permission {
  NORMAL = 'normal',
  AMBASSADOR = 'ambassador',  // 외교권자
  AUDITOR = 'auditor',        // 감찰관
  CHIEF = 'chief',            // 수뇌 권한
}

/**
 * 관직별 권한 매트릭스
 */
export const OFFICER_PERMISSIONS = {
  // 재야는 모든 권한 없음
  [OfficerLevel.WANDERER]: {
    canAccessBoard: false,
    canAccessSecret: false,
    canAccessNation: false,
    canAppointOfficer: false,
    canDeclareWar: false,
    canMakeDiplomacy: false,
    canSetPolicy: false,
    canUseTreasury: false,
    canKickMember: false,
    canTransferLeader: false,
    maxSecretLevel: 0,
  },
  
  // 병졸
  [OfficerLevel.SOLDIER]: {
    canAccessBoard: true,
    canAccessSecret: false,
    canAccessNation: false,
    canAppointOfficer: false,
    canDeclareWar: false,
    canMakeDiplomacy: false,
    canSetPolicy: false,
    canUseTreasury: false,
    canKickMember: false,
    canTransferLeader: false,
    maxSecretLevel: 0,
  },
  
  // 지방관 (2~4)
  [OfficerLevel.OFFICER_2]: {
    canAccessBoard: true,
    canAccessSecret: false,
    canAccessNation: false,
    canAppointOfficer: false,
    canDeclareWar: false,
    canMakeDiplomacy: false,
    canSetPolicy: false,
    canUseTreasury: false,
    canKickMember: false,
    canTransferLeader: false,
    maxSecretLevel: 1,
  },
  [OfficerLevel.OFFICER_3]: {
    canAccessBoard: true,
    canAccessSecret: false,
    canAccessNation: false,
    canAppointOfficer: false,
    canDeclareWar: false,
    canMakeDiplomacy: false,
    canSetPolicy: false,
    canUseTreasury: false,
    canKickMember: false,
    canTransferLeader: false,
    maxSecretLevel: 1,
  },
  [OfficerLevel.OFFICER_4]: {
    canAccessBoard: true,
    canAccessSecret: false,
    canAccessNation: false,
    canAppointOfficer: false,
    canDeclareWar: false,
    canMakeDiplomacy: false,
    canSetPolicy: false,
    canUseTreasury: false,
    canKickMember: false,
    canTransferLeader: false,
    maxSecretLevel: 1,
  },
  
  // 수뇌부 기본 (5~7)
  [OfficerLevel.CHIEF_5]: {
    canAccessBoard: true,
    canAccessSecret: true,
    canAccessNation: true,
    canAppointOfficer: false,
    canDeclareWar: false,
    canMakeDiplomacy: false,
    canSetPolicy: false,
    canUseTreasury: true,
    canKickMember: false,
    canTransferLeader: false,
    maxSecretLevel: 2,
  },
  [OfficerLevel.CHIEF_6]: {
    canAccessBoard: true,
    canAccessSecret: true,
    canAccessNation: true,
    canAppointOfficer: false,
    canDeclareWar: false,
    canMakeDiplomacy: false,
    canSetPolicy: false,
    canUseTreasury: true,
    canKickMember: false,
    canTransferLeader: false,
    maxSecretLevel: 2,
  },
  [OfficerLevel.CHIEF_7]: {
    canAccessBoard: true,
    canAccessSecret: true,
    canAccessNation: true,
    canAppointOfficer: false,
    canDeclareWar: false,
    canMakeDiplomacy: false,
    canSetPolicy: false,
    canUseTreasury: true,
    canKickMember: false,
    canTransferLeader: false,
    maxSecretLevel: 2,
  },
  
  // 고위 수뇌부 (8~10)
  [OfficerLevel.CHIEF_8]: {
    canAccessBoard: true,
    canAccessSecret: true,
    canAccessNation: true,
    canAppointOfficer: true,
    canDeclareWar: true,
    canMakeDiplomacy: false,
    canSetPolicy: false,
    canUseTreasury: true,
    canKickMember: false,
    canTransferLeader: false,
    maxSecretLevel: 3,
  },
  [OfficerLevel.CHIEF_9]: {
    canAccessBoard: true,
    canAccessSecret: true,
    canAccessNation: true,
    canAppointOfficer: true,
    canDeclareWar: true,
    canMakeDiplomacy: false,
    canSetPolicy: false,
    canUseTreasury: true,
    canKickMember: false,
    canTransferLeader: false,
    maxSecretLevel: 3,
  },
  [OfficerLevel.CHIEF_10]: {
    canAccessBoard: true,
    canAccessSecret: true,
    canAccessNation: true,
    canAppointOfficer: true,
    canDeclareWar: true,
    canMakeDiplomacy: true,
    canSetPolicy: false,
    canUseTreasury: true,
    canKickMember: false,
    canTransferLeader: false,
    maxSecretLevel: 3,
  },
  
  // 부군주 (11)
  [OfficerLevel.CHIEF_11]: {
    canAccessBoard: true,
    canAccessSecret: true,
    canAccessNation: true,
    canAppointOfficer: true,
    canDeclareWar: true,
    canMakeDiplomacy: true,
    canSetPolicy: true,
    canUseTreasury: true,
    canKickMember: true,
    canTransferLeader: false,
    maxSecretLevel: 4,
  },
  
  // 군주 (12)
  [OfficerLevel.KING]: {
    canAccessBoard: true,
    canAccessSecret: true,
    canAccessNation: true,
    canAppointOfficer: true,
    canDeclareWar: true,
    canMakeDiplomacy: true,
    canSetPolicy: true,
    canUseTreasury: true,
    canKickMember: true,
    canTransferLeader: true,
    maxSecretLevel: 4,
  },
};

/**
 * 국가 레벨별 수뇌부 정원
 */
export const CHIEF_SLOTS_BY_LEVEL: Record<number, number> = {
  0: 0,   // 재야
  1: 2,   // 영주
  2: 3,   // 군벌
  3: 4,   // 주자사
  4: 5,   // 주목
  5: 6,   // 공
  6: 7,   // 왕
  7: 8,   // 황제
};

export class OfficerSystemService {
  /**
   * 장수의 권한 조회
   */
  static getPermissions(generalData: any): typeof OFFICER_PERMISSIONS[OfficerLevel.WANDERER] {
    const officerLevel = generalData.officer_level || 0;
    const permission = generalData.permission || Permission.NORMAL;
    const penalty = generalData.penalty || {};

    // 수뇌부 벌칙 체크
    if (penalty.NoChief || penalty.no_chief) {
      return OFFICER_PERMISSIONS[OfficerLevel.SOLDIER];
    }

    let basePermissions = OFFICER_PERMISSIONS[officerLevel as OfficerLevel] 
      || OFFICER_PERMISSIONS[OfficerLevel.WANDERER];

    // 특수 권한으로 인한 권한 상승
    if (permission === Permission.AMBASSADOR) {
      return {
        ...basePermissions,
        canMakeDiplomacy: true,
        maxSecretLevel: Math.max(basePermissions.maxSecretLevel, 4),
      };
    }
    
    if (permission === Permission.AUDITOR) {
      return {
        ...basePermissions,
        canAccessSecret: true,
        maxSecretLevel: Math.max(basePermissions.maxSecretLevel, 3),
      };
    }

    return basePermissions;
  }

  /**
   * 특정 권한 체크
   */
  static hasPermission(
    generalData: any,
    permissionKey: keyof typeof OFFICER_PERMISSIONS[OfficerLevel.WANDERER]
  ): boolean {
    const permissions = this.getPermissions(generalData);
    return permissions[permissionKey] as boolean;
  }

  /**
   * 장수 임명
   */
  static async appointOfficer(
    sessionId: string,
    appointerId: number,
    targetId: number,
    newOfficerLevel: number,
    officerCity?: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 임명권자 조회
      const appointer = await generalRepository.findBySessionAndNo(sessionId, appointerId);
      if (!appointer) {
        return { success: false, message: '임명권자를 찾을 수 없습니다' };
      }

      const appointerData = appointer.data || {};
      const appointerLevel = appointerData.officer_level || 0;
      const nationId = appointerData.nation || 0;

      // 임명 권한 체크
      if (!this.hasPermission(appointerData, 'canAppointOfficer')) {
        return { success: false, message: '임명 권한이 없습니다' };
      }

      // 대상 장수 조회
      const target = await generalRepository.findBySessionAndNo(sessionId, targetId);
      if (!target) {
        return { success: false, message: '대상 장수를 찾을 수 없습니다' };
      }

      const targetData = target.data || {};

      // 같은 국가인지 확인
      if (targetData.nation !== nationId) {
        return { success: false, message: '같은 국가의 장수만 임명할 수 있습니다' };
      }

      // 자신보다 높은 직위 임명 불가
      if (newOfficerLevel >= appointerLevel && appointerLevel !== OfficerLevel.KING) {
        return { success: false, message: '자신과 같거나 높은 직위로 임명할 수 없습니다' };
      }

      // 수뇌부 정원 체크
      if (newOfficerLevel >= OfficerLevel.CHIEF_5) {
        const nation = await nationRepository.findByNationNum(sessionId, nationId);
        const nationLevel = nation?.data?.level || nation?.level || 0;
        const maxSlots = CHIEF_SLOTS_BY_LEVEL[nationLevel] || 2;

        const currentChiefs = await generalRepository.findByFilter({
          session_id: sessionId,
          'data.nation': nationId,
          'data.officer_level': { $gte: OfficerLevel.CHIEF_5 },
        });

        // 현재 대상이 이미 수뇌부가 아닌 경우에만 정원 체크
        if (targetData.officer_level < OfficerLevel.CHIEF_5 && currentChiefs.length >= maxSlots) {
          return { success: false, message: `수뇌부 정원(${maxSlots}명)이 가득 찼습니다` };
        }
      }

      // 지방관 임명 시 도시 체크
      if (newOfficerLevel >= OfficerLevel.OFFICER_2 && newOfficerLevel <= OfficerLevel.OFFICER_4) {
        if (!officerCity) {
          return { success: false, message: '지방관 임명 시 담당 도시가 필요합니다' };
        }

        // 도시 소유권 체크
        const city = await cityRepository.findByCityNum(sessionId, officerCity) as any;
        if (!city || city.nation !== nationId) {
          return { success: false, message: '해당 도시는 국가 소유가 아닙니다' };
        }
      }

      // 임명 처리
      const updateData: any = {
        'data.officer_level': newOfficerLevel,
      };

      if (officerCity !== undefined) {
        updateData['data.officer_city'] = officerCity;
      }

      await generalRepository.updateBySessionAndNo(sessionId, targetId, updateData);

      // 국가 레벨에 따른 직위명 조회
      const nation = await nationRepository.findByNationNum(sessionId, nationId);
      const nationLevel = nation?.data?.level || nation?.level || 0;
      const title = getOfficerTitle(newOfficerLevel, nationLevel);

      return { 
        success: true, 
        message: `${targetData.name || '장수'}을(를) ${title}(으)로 임명했습니다` 
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 장수 해임
   */
  static async dismissOfficer(
    sessionId: string,
    dismisserId: number,
    targetId: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      const dismisser = await generalRepository.findBySessionAndNo(sessionId, dismisserId);
      if (!dismisser) {
        return { success: false, message: '해임권자를 찾을 수 없습니다' };
      }

      const dismisserData = dismisser.data || {};
      const dismisserLevel = dismisserData.officer_level || 0;
      const nationId = dismisserData.nation || 0;

      // 임명 권한으로 해임도 가능
      if (!this.hasPermission(dismisserData, 'canAppointOfficer')) {
        return { success: false, message: '해임 권한이 없습니다' };
      }

      const target = await generalRepository.findBySessionAndNo(sessionId, targetId);
      if (!target) {
        return { success: false, message: '대상 장수를 찾을 수 없습니다' };
      }

      const targetData = target.data || {};

      if (targetData.nation !== nationId) {
        return { success: false, message: '같은 국가의 장수만 해임할 수 있습니다' };
      }

      // 자신보다 높은 직위 해임 불가
      const targetLevel = targetData.officer_level || 0;
      if (targetLevel >= dismisserLevel && dismisserLevel !== OfficerLevel.KING) {
        return { success: false, message: '자신과 같거나 높은 직위를 해임할 수 없습니다' };
      }

      // 군주 해임 불가
      if (targetLevel === OfficerLevel.KING) {
        return { success: false, message: '군주는 해임할 수 없습니다' };
      }

      // 해임 처리 (병졸로 강등)
      await generalRepository.updateBySessionAndNo(sessionId, targetId, {
        'data.officer_level': OfficerLevel.SOLDIER,
        'data.officer_city': 0,
        'data.permission': Permission.NORMAL,
      });

      return { 
        success: true, 
        message: `${targetData.name || '장수'}을(를) 해임했습니다` 
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 특수 권한 부여 (외교권자/감찰관)
   */
  static async grantSpecialPermission(
    sessionId: string,
    granterId: number,
    targetId: number,
    permission: Permission
  ): Promise<{ success: boolean; message: string }> {
    try {
      const granter = await generalRepository.findBySessionAndNo(sessionId, granterId);
      if (!granter) {
        return { success: false, message: '권한 부여자를 찾을 수 없습니다' };
      }

      const granterData = granter.data || {};
      
      // 군주만 특수 권한 부여 가능
      if (granterData.officer_level !== OfficerLevel.KING) {
        return { success: false, message: '군주만 특수 권한을 부여할 수 있습니다' };
      }

      const nationId = granterData.nation || 0;
      const target = await generalRepository.findBySessionAndNo(sessionId, targetId);
      
      if (!target || target.data?.nation !== nationId) {
        return { success: false, message: '같은 국가의 장수에게만 권한을 부여할 수 있습니다' };
      }

      // 외교권자는 최대 2명
      if (permission === Permission.AMBASSADOR) {
        const ambassadors = await generalRepository.findByFilter({
          session_id: sessionId,
          'data.nation': nationId,
          'data.permission': Permission.AMBASSADOR,
        });

        if (ambassadors.length >= 2 && target.data?.permission !== Permission.AMBASSADOR) {
          return { success: false, message: '외교권자는 최대 2명까지만 지정 가능합니다' };
        }
      }

      // 헌신도 체크
      const dedication = target.data?.dedication || 0;
      if (permission === Permission.AMBASSADOR && dedication < 24) {
        return { success: false, message: '외교권자는 헌신도 24 이상이 필요합니다' };
      }
      if (permission === Permission.AUDITOR && dedication < 12) {
        return { success: false, message: '감찰관은 헌신도 12 이상이 필요합니다' };
      }

      await generalRepository.updateBySessionAndNo(sessionId, targetId, {
        'data.permission': permission,
      });

      const permissionName = permission === Permission.AMBASSADOR ? '외교권자' : '감찰관';
      return { 
        success: true, 
        message: `${target.data?.name || '장수'}에게 ${permissionName} 권한을 부여했습니다` 
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 특수 권한 해제
   */
  static async revokeSpecialPermission(
    sessionId: string,
    revokerId: number,
    targetId: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      const revoker = await generalRepository.findBySessionAndNo(sessionId, revokerId);
      if (!revoker || revoker.data?.officer_level !== OfficerLevel.KING) {
        return { success: false, message: '군주만 특수 권한을 해제할 수 있습니다' };
      }

      const nationId = revoker.data?.nation || 0;
      const target = await generalRepository.findBySessionAndNo(sessionId, targetId);

      if (!target || target.data?.nation !== nationId) {
        return { success: false, message: '같은 국가의 장수만 권한 해제 가능합니다' };
      }

      await generalRepository.updateBySessionAndNo(sessionId, targetId, {
        'data.permission': Permission.NORMAL,
      });

      return { 
        success: true, 
        message: `${target.data?.name || '장수'}의 특수 권한을 해제했습니다` 
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 국가 수뇌부 목록 조회
   */
  static async getNationOfficers(
    sessionId: string,
    nationId: number
  ): Promise<{
    king: any | null;
    chiefs: any[];
    ambassadors: any[];
    auditors: any[];
    localOfficers: any[];
  }> {
    try {
      const generals = await generalRepository.findByFilter({
        session_id: sessionId,
        'data.nation': nationId,
      });

      const nation = await nationRepository.findByNationNum(sessionId, nationId);
      const nationLevel = nation?.data?.level || nation?.level || 0;

      let king: any = null;
      const chiefs: any[] = [];
      const ambassadors: any[] = [];
      const auditors: any[] = [];
      const localOfficers: any[] = [];

      for (const general of generals) {
        const genData = general.data || {};
        const officerLevel = genData.officer_level || 0;
        const permission = genData.permission || Permission.NORMAL;

        const officerInfo = {
          no: genData.no,
          name: genData.name,
          officer_level: officerLevel,
          officer_city: genData.officer_city,
          title: getOfficerTitle(officerLevel, nationLevel),
          permission,
        };

        if (officerLevel === OfficerLevel.KING) {
          king = officerInfo;
        } else if (officerLevel >= OfficerLevel.CHIEF_5) {
          chiefs.push(officerInfo);
        } else if (officerLevel >= OfficerLevel.OFFICER_2) {
          localOfficers.push(officerInfo);
        }

        if (permission === Permission.AMBASSADOR) {
          ambassadors.push(officerInfo);
        } else if (permission === Permission.AUDITOR) {
          auditors.push(officerInfo);
        }
      }

      // 직위순 정렬
      chiefs.sort((a, b) => b.officer_level - a.officer_level);
      localOfficers.sort((a, b) => b.officer_level - a.officer_level);

      return {
        king,
        chiefs,
        ambassadors,
        auditors,
        localOfficers,
      };
    } catch (error: any) {
      return {
        king: null,
        chiefs: [],
        ambassadors: [],
        auditors: [],
        localOfficers: [],
      };
    }
  }

  /**
   * 수뇌부 정원 정보 조회
   */
  static async getChiefSlotInfo(sessionId: string, nationId: number): Promise<{
    maxSlots: number;
    usedSlots: number;
    available: number;
  }> {
    const nation = await nationRepository.findByNationNum(sessionId, nationId);
    const nationLevel = nation?.data?.level || nation?.level || 0;
    const maxSlots = CHIEF_SLOTS_BY_LEVEL[nationLevel] || 2;

    const chiefs = await generalRepository.findByFilter({
      session_id: sessionId,
      'data.nation': nationId,
      'data.officer_level': { $gte: OfficerLevel.CHIEF_5, $lt: OfficerLevel.KING },
    });

    return {
      maxSlots,
      usedSlots: chiefs.length,
      available: Math.max(0, maxSlots - chiefs.length),
    };
  }
}


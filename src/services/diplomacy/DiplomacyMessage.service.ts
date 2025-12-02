/**
 * DiplomacyMessage.service.ts - 외교 메시지/알림 서비스
 *
 * 외교 상태 변경 알림, 히스토리 로깅 담당
 * PHP 참조: core/hwe/sammo/DiplomaticMessage.php
 */

import { ngDiplomacyRepository } from '../../repositories/ng-diplomacy.repository';
import { DiplomacyState, DiplomacyStateName } from './DiplomacyState.service';
import { DiplomacyProposalType, DiplomacyProposalTypeName } from './DiplomacyProposal.service';

/**
 * 외교 메시지 타입
 */
export enum DiplomacyMessageType {
  // 상태 변경 알림
  STATE_CHANGED = 'state_changed',
  
  // 제안 관련
  PROPOSAL_RECEIVED = 'proposal_received',
  PROPOSAL_ACCEPTED = 'proposal_accepted',
  PROPOSAL_DECLINED = 'proposal_declined',
  PROPOSAL_EXPIRED = 'proposal_expired',
  
  // 특수 상황
  WAR_DECLARED = 'war_declared',
  PEACE_ACHIEVED = 'peace_achieved',
  PACT_BROKEN = 'pact_broken',
  PACT_EXPIRED = 'pact_expired'
}

/**
 * 외교 메시지 데이터
 */
export interface DiplomacyMessageData {
  sessionId: string;
  type: DiplomacyMessageType;
  srcNationId: number;
  srcNationName: string;
  destNationId: number;
  destNationName: string;
  oldState?: DiplomacyState;
  newState?: DiplomacyState;
  proposalType?: DiplomacyProposalType;
  year?: number;
  month?: number;
  term?: number;
  generalId?: number;
  generalName?: string;
  message?: string;
  timestamp?: Date;
}

/**
 * 알림 결과
 */
export interface NotificationResult {
  success: boolean;
  messageId?: string | number;
  reason?: string;
}

/**
 * DiplomacyMessageService - 외교 메시지/알림 서비스
 */
export class DiplomacyMessageService {
  // ============================================
  // 상태 변경 알림
  // ============================================

  /**
   * 외교 상태 변경 알림 생성
   */
  static async notifyStateChange(
    data: DiplomacyMessageData
  ): Promise<NotificationResult> {
    try {
      const { sessionId, srcNationId, srcNationName, destNationId, destNationName, oldState, newState } = data;

      const oldStateName = oldState !== undefined ? DiplomacyStateName[oldState] : '알 수 없음';
      const newStateName = newState !== undefined ? DiplomacyStateName[newState] : '알 수 없음';

      const messageText = this.buildStateChangeMessage(
        srcNationName,
        destNationName,
        oldStateName,
        newStateName,
        data.generalName
      );

      // 양방향 알림 생성
      const srcNotification = await this.createNotification({
        ...data,
        type: DiplomacyMessageType.STATE_CHANGED,
        message: messageText,
        timestamp: new Date()
      });

      const destNotification = await this.createNotification({
        ...data,
        type: DiplomacyMessageType.STATE_CHANGED,
        srcNationId: destNationId,
        srcNationName: destNationName,
        destNationId: srcNationId,
        destNationName: srcNationName,
        message: messageText,
        timestamp: new Date()
      });

      return {
        success: true,
        reason: `외교 상태 변경 알림: ${oldStateName} → ${newStateName}`
      };
    } catch (error) {
      console.error('[DiplomacyMessageService] notifyStateChange error:', error);
      return { success: false, reason: '알림 생성 실패' };
    }
  }

  /**
   * 선전포고 알림
   */
  static async notifyWarDeclaration(
    sessionId: string,
    srcNationId: number,
    srcNationName: string,
    destNationId: number,
    destNationName: string,
    generalId: number,
    generalName: string,
    year: number,
    month: number
  ): Promise<NotificationResult> {
    try {
      const messageText = `【외교】${year}년 ${month}월: ${srcNationName}에서 ${destNationName}에 선전포고`;

      await this.createNotification({
        sessionId,
        type: DiplomacyMessageType.WAR_DECLARED,
        srcNationId,
        srcNationName,
        destNationId,
        destNationName,
        newState: DiplomacyState.DECLARATION,
        generalId,
        generalName,
        year,
        month,
        message: messageText,
        timestamp: new Date()
      });

      return { success: true, reason: '선전포고 알림 전송 완료' };
    } catch (error) {
      console.error('[DiplomacyMessageService] notifyWarDeclaration error:', error);
      return { success: false, reason: '선전포고 알림 실패' };
    }
  }

  /**
   * 종전 알림
   */
  static async notifyPeaceAchieved(
    sessionId: string,
    nationId1: number,
    nationName1: string,
    nationId2: number,
    nationName2: string,
    generalId: number,
    generalName: string,
    year: number,
    month: number
  ): Promise<NotificationResult> {
    try {
      const messageText = `【외교】${year}년 ${month}월: ${nationName1}와(과) ${nationName2} 종전 합의`;

      // 양방향 알림
      await this.createNotification({
        sessionId,
        type: DiplomacyMessageType.PEACE_ACHIEVED,
        srcNationId: nationId1,
        srcNationName: nationName1,
        destNationId: nationId2,
        destNationName: nationName2,
        newState: DiplomacyState.PEACE,
        generalId,
        generalName,
        year,
        month,
        message: messageText,
        timestamp: new Date()
      });

      return { success: true, reason: '종전 알림 전송 완료' };
    } catch (error) {
      console.error('[DiplomacyMessageService] notifyPeaceAchieved error:', error);
      return { success: false, reason: '종전 알림 실패' };
    }
  }

  /**
   * 불가침 체결 알림
   */
  static async notifyNonAggressionSigned(
    sessionId: string,
    nationId1: number,
    nationName1: string,
    nationId2: number,
    nationName2: string,
    generalId: number,
    generalName: string,
    year: number,
    month: number,
    untilYear: number,
    untilMonth: number
  ): Promise<NotificationResult> {
    try {
      const messageText = `【외교】${year}년 ${month}월: ${nationName1}와(과) ${nationName2} ${untilYear}년 ${untilMonth}월까지 불가침 조약 체결`;

      await this.createNotification({
        sessionId,
        type: DiplomacyMessageType.STATE_CHANGED,
        srcNationId: nationId1,
        srcNationName: nationName1,
        destNationId: nationId2,
        destNationName: nationName2,
        newState: DiplomacyState.NO_AGGRESSION,
        proposalType: DiplomacyProposalType.NO_AGGRESSION,
        generalId,
        generalName,
        year,
        month,
        message: messageText,
        timestamp: new Date()
      });

      return { success: true, reason: '불가침 체결 알림 전송 완료' };
    } catch (error) {
      console.error('[DiplomacyMessageService] notifyNonAggressionSigned error:', error);
      return { success: false, reason: '불가침 체결 알림 실패' };
    }
  }

  /**
   * 불가침 파기 알림
   */
  static async notifyPactBroken(
    sessionId: string,
    nationId1: number,
    nationName1: string,
    nationId2: number,
    nationName2: string,
    generalId: number,
    generalName: string,
    year: number,
    month: number
  ): Promise<NotificationResult> {
    try {
      const messageText = `【외교】${year}년 ${month}월: ${nationName1}와(과) ${nationName2} 불가침 조약 파기`;

      await this.createNotification({
        sessionId,
        type: DiplomacyMessageType.PACT_BROKEN,
        srcNationId: nationId1,
        srcNationName: nationName1,
        destNationId: nationId2,
        destNationName: nationName2,
        oldState: DiplomacyState.NO_AGGRESSION,
        newState: DiplomacyState.PEACE,
        generalId,
        generalName,
        year,
        month,
        message: messageText,
        timestamp: new Date()
      });

      return { success: true, reason: '불가침 파기 알림 전송 완료' };
    } catch (error) {
      console.error('[DiplomacyMessageService] notifyPactBroken error:', error);
      return { success: false, reason: '불가침 파기 알림 실패' };
    }
  }

  // ============================================
  // 제안 관련 알림
  // ============================================

  /**
   * 제안 수신 알림
   */
  static async notifyProposalReceived(
    sessionId: string,
    proposalType: DiplomacyProposalType,
    srcNationId: number,
    srcNationName: string,
    destNationId: number,
    destNationName: string,
    generalId: number,
    generalName: string,
    year?: number,
    month?: number
  ): Promise<NotificationResult> {
    try {
      const typeName = DiplomacyProposalTypeName[proposalType];
      let messageText = `${srcNationName}에서 ${typeName} 제의가 도착했습니다.`;
      
      if (proposalType === DiplomacyProposalType.NO_AGGRESSION && year && month) {
        messageText = `${srcNationName}에서 ${year}년 ${month}월까지 ${typeName} 제의가 도착했습니다.`;
      }

      await this.createNotification({
        sessionId,
        type: DiplomacyMessageType.PROPOSAL_RECEIVED,
        srcNationId,
        srcNationName,
        destNationId,
        destNationName,
        proposalType,
        generalId,
        generalName,
        year,
        month,
        message: messageText,
        timestamp: new Date()
      });

      return { success: true, reason: '제안 수신 알림 전송 완료' };
    } catch (error) {
      console.error('[DiplomacyMessageService] notifyProposalReceived error:', error);
      return { success: false, reason: '제안 수신 알림 실패' };
    }
  }

  /**
   * 제안 수락 알림
   */
  static async notifyProposalAccepted(
    sessionId: string,
    proposalType: DiplomacyProposalType,
    srcNationId: number,
    srcNationName: string,
    destNationId: number,
    destNationName: string,
    generalId: number,
    generalName: string
  ): Promise<NotificationResult> {
    try {
      const typeName = DiplomacyProposalTypeName[proposalType];
      const messageText = `${destNationName}이(가) ${typeName} 제의를 수락했습니다.`;

      await this.createNotification({
        sessionId,
        type: DiplomacyMessageType.PROPOSAL_ACCEPTED,
        srcNationId,
        srcNationName,
        destNationId,
        destNationName,
        proposalType,
        generalId,
        generalName,
        message: messageText,
        timestamp: new Date()
      });

      return { success: true, reason: '제안 수락 알림 전송 완료' };
    } catch (error) {
      console.error('[DiplomacyMessageService] notifyProposalAccepted error:', error);
      return { success: false, reason: '제안 수락 알림 실패' };
    }
  }

  /**
   * 제안 거절 알림
   */
  static async notifyProposalDeclined(
    sessionId: string,
    proposalType: DiplomacyProposalType,
    srcNationId: number,
    srcNationName: string,
    destNationId: number,
    destNationName: string,
    generalId: number,
    generalName: string
  ): Promise<NotificationResult> {
    try {
      const typeName = DiplomacyProposalTypeName[proposalType];
      const messageText = `${destNationName}이(가) ${typeName} 제의를 거절했습니다.`;

      await this.createNotification({
        sessionId,
        type: DiplomacyMessageType.PROPOSAL_DECLINED,
        srcNationId,
        srcNationName,
        destNationId,
        destNationName,
        proposalType,
        generalId,
        generalName,
        message: messageText,
        timestamp: new Date()
      });

      return { success: true, reason: '제안 거절 알림 전송 완료' };
    } catch (error) {
      console.error('[DiplomacyMessageService] notifyProposalDeclined error:', error);
      return { success: false, reason: '제안 거절 알림 실패' };
    }
  }

  // ============================================
  // 조약 만료 알림
  // ============================================

  /**
   * 조약 만료 알림 (선전포고 → 교전, 불가침/동맹 → 평화)
   */
  static async notifyPactExpired(
    sessionId: string,
    nationId1: number,
    nationName1: string,
    nationId2: number,
    nationName2: string,
    oldState: DiplomacyState,
    newState: DiplomacyState,
    year: number,
    month: number
  ): Promise<NotificationResult> {
    try {
      const oldStateName = DiplomacyStateName[oldState];
      const newStateName = DiplomacyStateName[newState];
      
      let messageText: string;
      if (oldState === DiplomacyState.DECLARATION) {
        messageText = `【외교】${year}년 ${month}월: ${nationName1}와(과) ${nationName2} 선전포고 기간 종료, 교전 돌입`;
      } else {
        messageText = `【외교】${year}년 ${month}월: ${nationName1}와(과) ${nationName2} ${oldStateName} 조약 만료`;
      }

      await this.createNotification({
        sessionId,
        type: DiplomacyMessageType.PACT_EXPIRED,
        srcNationId: nationId1,
        srcNationName: nationName1,
        destNationId: nationId2,
        destNationName: nationName2,
        oldState,
        newState,
        year,
        month,
        message: messageText,
        timestamp: new Date()
      });

      return { success: true, reason: '조약 만료 알림 전송 완료' };
    } catch (error) {
      console.error('[DiplomacyMessageService] notifyPactExpired error:', error);
      return { success: false, reason: '조약 만료 알림 실패' };
    }
  }

  // ============================================
  // 히스토리 조회
  // ============================================

  /**
   * 국가의 외교 히스토리 조회
   */
  static async getDiplomacyHistory(
    sessionId: string,
    nationId: number,
    limit: number = 50
  ): Promise<DiplomacyMessageData[]> {
    try {
      const messages = await ngDiplomacyRepository.findByFilter({
        session_id: sessionId,
        $or: [
          { 'data.srcNationId': nationId },
          { 'data.destNationId': nationId }
        ],
        'data.type': { $in: Object.values(DiplomacyMessageType) }
      });

      // @ts-ignore
      const sorted = messages
        .sort((a: any, b: any) => {
          const dateA = new Date(a.data?.timestamp || a.createdAt);
          const dateB = new Date(b.data?.timestamp || b.createdAt);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, limit);

      return sorted.map((m: any) => m.data as DiplomacyMessageData);
    } catch (error) {
      console.error('[DiplomacyMessageService] getDiplomacyHistory error:', error);
      return [];
    }
  }

  /**
   * 두 국가 간 외교 히스토리 조회
   */
  static async getBilateralHistory(
    sessionId: string,
    nationId1: number,
    nationId2: number,
    limit: number = 20
  ): Promise<DiplomacyMessageData[]> {
    try {
      const messages = await ngDiplomacyRepository.findByFilter({
        session_id: sessionId,
        $or: [
          { 'data.srcNationId': nationId1, 'data.destNationId': nationId2 },
          { 'data.srcNationId': nationId2, 'data.destNationId': nationId1 }
        ],
        'data.type': { $in: Object.values(DiplomacyMessageType) }
      });

      // @ts-ignore
      const sorted = messages
        .sort((a: any, b: any) => {
          const dateA = new Date(a.data?.timestamp || a.createdAt);
          const dateB = new Date(b.data?.timestamp || b.createdAt);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, limit);

      return sorted.map((m: any) => m.data as DiplomacyMessageData);
    } catch (error) {
      console.error('[DiplomacyMessageService] getBilateralHistory error:', error);
      return [];
    }
  }

  // ============================================
  // 내부 헬퍼
  // ============================================

  /**
   * 알림 생성 (내부용)
   */
  private static async createNotification(
    data: DiplomacyMessageData
  ): Promise<string | number | null> {
    try {
      const letterNo = await ngDiplomacyRepository.getNextLetterNo(data.sessionId);

      await ngDiplomacyRepository.create({
        session_id: data.sessionId,
        data: {
          no: letterNo,
          ...data,
          createdAt: new Date()
        }
      });

      return letterNo;
    } catch (error) {
      console.error('[DiplomacyMessageService] createNotification error:', error);
      return null;
    }
  }

  /**
   * 상태 변경 메시지 생성
   */
  private static buildStateChangeMessage(
    srcNationName: string,
    destNationName: string,
    oldStateName: string,
    newStateName: string,
    generalName?: string
  ): string {
    if (generalName) {
      return `${srcNationName}의 ${generalName}이(가) ${destNationName}과의 외교 관계를 ${oldStateName}에서 ${newStateName}(으)로 변경했습니다.`;
    }
    return `${srcNationName}와(과) ${destNationName}의 외교 관계가 ${oldStateName}에서 ${newStateName}(으)로 변경되었습니다.`;
  }
}



/**
 * DiplomacyProposal.service.ts - 외교 제안/수락 서비스
 *
 * PHP 참조:
 * - core/hwe/sammo/DiplomaticMessage.php
 * - core/hwe/sammo/Command/Nation/che_불가침*.php
 * - core/hwe/sammo/Command/Nation/che_선전포고.php
 * - core/hwe/sammo/Command/Nation/che_종전*.php
 */

import { diplomacyRepository } from '../../repositories/diplomacy.repository';
import { ngDiplomacyRepository } from '../../repositories/ng-diplomacy.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { generalRepository } from '../../repositories/general.repository';
import { DiplomacyState, DiplomacyStateService } from './DiplomacyState.service';

/**
 * 외교 제안 타입
 */
export enum DiplomacyProposalType {
  NO_AGGRESSION = 'noAggression',     // 불가침
  CANCEL_NA = 'cancelNA',             // 불가침 파기
  STOP_WAR = 'stopWar',               // 종전
  DECLARE_WAR = 'declareWar'          // 선전포고 (제의 필요 없음)
}

/**
 * 외교 제안 타입 이름
 */
export const DiplomacyProposalTypeName: Record<DiplomacyProposalType, string> = {
  [DiplomacyProposalType.NO_AGGRESSION]: '불가침',
  [DiplomacyProposalType.CANCEL_NA]: '불가침 파기',
  [DiplomacyProposalType.STOP_WAR]: '종전',
  [DiplomacyProposalType.DECLARE_WAR]: '선전포고'
};

/**
 * 외교 제안 상태
 */
export enum ProposalStatus {
  PENDING = 'pending',      // 대기 중
  ACCEPTED = 'accepted',    // 수락됨
  DECLINED = 'declined',    // 거절됨
  EXPIRED = 'expired',      // 만료됨
  INVALID = 'invalid'       // 유효하지 않음
}

/**
 * 제안 데이터 인터페이스
 */
export interface ProposalData {
  sessionId: string;
  srcNationId: number;
  srcNationName: string;
  srcGeneralId: number;
  srcGeneralName: string;
  destNationId: number;
  destNationName: string;
  type: DiplomacyProposalType;
  year?: number;        // 불가침 기한 (년)
  month?: number;       // 불가침 기한 (월)
  validUntil: Date;     // 제안 유효기간
  message?: string;
}

/**
 * 제안 결과 인터페이스
 */
export interface ProposalResult {
  success: boolean;
  reason: string;
  proposalId?: string | number;
}

/**
 * 수락 결과 인터페이스
 */
export interface AcceptResult {
  success: boolean;
  reason: string;
  newState?: DiplomacyState;
  term?: number;
}

/**
 * DiplomacyProposalService - 외교 제안/수락 서비스
 */
export class DiplomacyProposalService {
  // ============================================
  // 선전포고
  // ============================================

  /**
   * 선전포고 실행
   * 선전포고는 제의 없이 즉시 실행됨
   */
  static async declareWar(
    sessionId: string,
    srcNationId: number,
    destNationId: number
  ): Promise<AcceptResult> {
    if (srcNationId === 0 || destNationId === 0) {
      return { success: false, reason: '유효하지 않은 국가입니다.' };
    }

    if (srcNationId === destNationId) {
      return { success: false, reason: '자국에 선전포고할 수 없습니다.' };
    }

    try {
      // 현재 외교 상태 확인
      const relation = await DiplomacyStateService.getRelation(
        sessionId,
        srcNationId,
        destNationId
      );

      const currentState = relation?.state ?? DiplomacyState.PEACE;

      // 선전포고 가능 여부 검증
      const validation = DiplomacyStateService.canDeclareWar(currentState);
      if (!validation.valid) {
        return { success: false, reason: validation.reason || '선전포고 불가' };
      }

      // 선전포고 상태로 변경 (term = 24턴)
      const term = 24;
      await DiplomacyStateService.updateBilateralState(
        sessionId,
        srcNationId,
        destNationId,
        DiplomacyState.DECLARATION,
        term
      );

      return {
        success: true,
        reason: '선전포고가 완료되었습니다.',
        newState: DiplomacyState.DECLARATION,
        term
      };
    } catch (error) {
      console.error('[DiplomacyProposalService] declareWar error:', error);
      return { success: false, reason: '선전포고 처리 중 오류가 발생했습니다.' };
    }
  }

  // ============================================
  // 불가침 제의/수락
  // ============================================

  /**
   * 불가침 제의
   */
  static async proposeNonAggression(
    data: ProposalData
  ): Promise<ProposalResult> {
    const { sessionId, srcNationId, destNationId, year, month } = data;

    if (srcNationId === 0 || destNationId === 0) {
      return { success: false, reason: '유효하지 않은 국가입니다.' };
    }

    if (!year || !month) {
      return { success: false, reason: '불가침 기한이 필요합니다.' };
    }

    try {
      // 현재 외교 상태 확인
      const relation = await DiplomacyStateService.getRelation(
        sessionId,
        srcNationId,
        destNationId
      );

      const currentState = relation?.state ?? DiplomacyState.PEACE;

      // 불가침 제의 가능 여부 검증
      const validation = DiplomacyStateService.canProposeNonAggression(currentState);
      if (!validation.valid) {
        return { success: false, reason: validation.reason || '불가침 제의 불가' };
      }

      // 외교 서신 생성
      const letterNo = await ngDiplomacyRepository.getNextLetterNo(sessionId);

      await ngDiplomacyRepository.create({
        session_id: sessionId,
        data: {
          no: letterNo,
          type: DiplomacyProposalType.NO_AGGRESSION,
          srcNationId: data.srcNationId,
          srcNationName: data.srcNationName,
          srcGeneralId: data.srcGeneralId,
          srcGeneralName: data.srcGeneralName,
          destNationId: data.destNationId,
          destNationName: data.destNationName,
          year,
          month,
          validUntil: data.validUntil,
          message: data.message,
          state: 'proposed',
          status: ProposalStatus.PENDING,
          createdAt: new Date()
        }
      });

      return {
        success: true,
        reason: '불가침 제의 서신을 보냈습니다.',
        proposalId: letterNo
      };
    } catch (error) {
      console.error('[DiplomacyProposalService] proposeNonAggression error:', error);
      return { success: false, reason: '불가침 제의 처리 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 불가침 수락
   */
  static async acceptNonAggression(
    sessionId: string,
    proposalId: string | number,
    acceptorGeneralId: number,
    env: { year: number; month: number }
  ): Promise<AcceptResult> {
    try {
      // 제안 조회
      const proposal = await ngDiplomacyRepository.findByLetterNo(sessionId, proposalId);

      if (!proposal) {
        return { success: false, reason: '외교 서신을 찾을 수 없습니다.' };
      }

      const proposalData = proposal.data || {};

      // 유효성 검증
      const validation = this.validateProposal(proposalData, DiplomacyProposalType.NO_AGGRESSION);
      if (!validation.valid) {
        return { success: false, reason: validation.reason || '유효하지 않은 제안입니다.' };
      }

      // 기한 계산
      const { year, month } = proposalData;
      const currentMonth = env.year * 12 + env.month - 1;
      const reqMonth = year * 12 + month;

      if (reqMonth <= currentMonth) {
        return { success: false, reason: '이미 기한이 지났습니다.' };
      }

      const term = reqMonth - currentMonth;

      // 외교 상태 업데이트
      await DiplomacyStateService.updateBilateralState(
        sessionId,
        proposalData.srcNationId,
        proposalData.destNationId,
        DiplomacyState.NO_AGGRESSION,
        term
      );

      // 제안 상태 업데이트
      await ngDiplomacyRepository.updateById(proposal._id, {
        'data.status': ProposalStatus.ACCEPTED,
        'data.state': 'activated',
        'data.acceptedAt': new Date(),
        'data.acceptorGeneralId': acceptorGeneralId
      });

      return {
        success: true,
        reason: `${year}년 ${month}월까지 불가침에 성공했습니다.`,
        newState: DiplomacyState.NO_AGGRESSION,
        term
      };
    } catch (error) {
      console.error('[DiplomacyProposalService] acceptNonAggression error:', error);
      return { success: false, reason: '불가침 수락 처리 중 오류가 발생했습니다.' };
    }
  }

  // ============================================
  // 불가침 파기 제의/수락
  // ============================================

  /**
   * 불가침 파기 제의
   */
  static async proposeBreakNonAggression(
    data: Omit<ProposalData, 'year' | 'month'>
  ): Promise<ProposalResult> {
    const { sessionId, srcNationId, destNationId } = data;

    if (srcNationId === 0 || destNationId === 0) {
      return { success: false, reason: '유효하지 않은 국가입니다.' };
    }

    try {
      // 현재 외교 상태 확인
      const relation = await DiplomacyStateService.getRelation(
        sessionId,
        srcNationId,
        destNationId
      );

      const currentState = relation?.state ?? DiplomacyState.PEACE;

      // 불가침 파기 가능 여부 검증
      const validation = DiplomacyStateService.canBreakNonAggression(currentState);
      if (!validation.valid) {
        return { success: false, reason: validation.reason || '불가침 파기 불가' };
      }

      // 외교 서신 생성
      const letterNo = await ngDiplomacyRepository.getNextLetterNo(sessionId);

      await ngDiplomacyRepository.create({
        session_id: sessionId,
        data: {
          no: letterNo,
          type: DiplomacyProposalType.CANCEL_NA,
          srcNationId: data.srcNationId,
          srcNationName: data.srcNationName,
          srcGeneralId: data.srcGeneralId,
          srcGeneralName: data.srcGeneralName,
          destNationId: data.destNationId,
          destNationName: data.destNationName,
          validUntil: data.validUntil,
          message: data.message,
          state: 'proposed',
          status: ProposalStatus.PENDING,
          createdAt: new Date()
        }
      });

      return {
        success: true,
        reason: '불가침 파기 제의 서신을 보냈습니다.',
        proposalId: letterNo
      };
    } catch (error) {
      console.error('[DiplomacyProposalService] proposeBreakNonAggression error:', error);
      return { success: false, reason: '불가침 파기 제의 처리 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 불가침 파기 수락
   */
  static async acceptBreakNonAggression(
    sessionId: string,
    proposalId: string | number,
    acceptorGeneralId: number
  ): Promise<AcceptResult> {
    try {
      // 제안 조회
      const proposal = await ngDiplomacyRepository.findByLetterNo(sessionId, proposalId);

      if (!proposal) {
        return { success: false, reason: '외교 서신을 찾을 수 없습니다.' };
      }

      const proposalData = proposal.data || {};

      // 유효성 검증
      const validation = this.validateProposal(proposalData, DiplomacyProposalType.CANCEL_NA);
      if (!validation.valid) {
        return { success: false, reason: validation.reason || '유효하지 않은 제안입니다.' };
      }

      // 현재 상태 확인 (여전히 불가침 상태인지)
      const relation = await DiplomacyStateService.getRelation(
        sessionId,
        proposalData.srcNationId,
        proposalData.destNationId
      );

      if (relation?.state !== DiplomacyState.NO_AGGRESSION) {
        return { success: false, reason: '이미 불가침 상태가 아닙니다.' };
      }

      // 평화 상태로 변경
      await DiplomacyStateService.updateBilateralState(
        sessionId,
        proposalData.srcNationId,
        proposalData.destNationId,
        DiplomacyState.PEACE,
        0
      );

      // 제안 상태 업데이트
      await ngDiplomacyRepository.updateById(proposal._id, {
        'data.status': ProposalStatus.ACCEPTED,
        'data.state': 'activated',
        'data.acceptedAt': new Date(),
        'data.acceptorGeneralId': acceptorGeneralId
      });

      return {
        success: true,
        reason: '불가침 파기에 성공했습니다.',
        newState: DiplomacyState.PEACE,
        term: 0
      };
    } catch (error) {
      console.error('[DiplomacyProposalService] acceptBreakNonAggression error:', error);
      return { success: false, reason: '불가침 파기 수락 처리 중 오류가 발생했습니다.' };
    }
  }

  // ============================================
  // 종전 제의/수락
  // ============================================

  /**
   * 종전 제의
   */
  static async proposePeace(
    data: Omit<ProposalData, 'year' | 'month'>
  ): Promise<ProposalResult> {
    const { sessionId, srcNationId, destNationId } = data;

    if (srcNationId === 0 || destNationId === 0) {
      return { success: false, reason: '유효하지 않은 국가입니다.' };
    }

    try {
      // 현재 외교 상태 확인
      const relation = await DiplomacyStateService.getRelation(
        sessionId,
        srcNationId,
        destNationId
      );

      const currentState = relation?.state ?? DiplomacyState.PEACE;

      // 종전 가능 여부 검증
      const validation = DiplomacyStateService.canProposePeace(currentState);
      if (!validation.valid) {
        return { success: false, reason: validation.reason || '종전 제의 불가' };
      }

      // 외교 서신 생성
      const letterNo = await ngDiplomacyRepository.getNextLetterNo(sessionId);

      await ngDiplomacyRepository.create({
        session_id: sessionId,
        data: {
          no: letterNo,
          type: DiplomacyProposalType.STOP_WAR,
          srcNationId: data.srcNationId,
          srcNationName: data.srcNationName,
          srcGeneralId: data.srcGeneralId,
          srcGeneralName: data.srcGeneralName,
          destNationId: data.destNationId,
          destNationName: data.destNationName,
          validUntil: data.validUntil,
          message: data.message,
          state: 'proposed',
          status: ProposalStatus.PENDING,
          deletable: false,
          createdAt: new Date()
        }
      });

      return {
        success: true,
        reason: '종전 제의 서신을 보냈습니다.',
        proposalId: letterNo
      };
    } catch (error) {
      console.error('[DiplomacyProposalService] proposePeace error:', error);
      return { success: false, reason: '종전 제의 처리 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 종전 수락
   */
  static async acceptPeace(
    sessionId: string,
    proposalId: string | number,
    acceptorGeneralId: number
  ): Promise<AcceptResult> {
    try {
      // 제안 조회
      const proposal = await ngDiplomacyRepository.findByLetterNo(sessionId, proposalId);

      if (!proposal) {
        return { success: false, reason: '외교 서신을 찾을 수 없습니다.' };
      }

      const proposalData = proposal.data || {};

      // 유효성 검증
      const validation = this.validateProposal(proposalData, DiplomacyProposalType.STOP_WAR);
      if (!validation.valid) {
        return { success: false, reason: validation.reason || '유효하지 않은 제안입니다.' };
      }

      // 현재 상태 확인 (교전/선전포고 상태인지)
      const relation = await DiplomacyStateService.getRelation(
        sessionId,
        proposalData.srcNationId,
        proposalData.destNationId
      );

      if (relation?.state !== DiplomacyState.WAR && relation?.state !== DiplomacyState.DECLARATION) {
        return { success: false, reason: '상대국과 선포, 전쟁중이지 않습니다.' };
      }

      // 평화 상태로 변경
      await DiplomacyStateService.updateBilateralState(
        sessionId,
        proposalData.srcNationId,
        proposalData.destNationId,
        DiplomacyState.PEACE,
        0
      );

      // 제안 상태 업데이트
      await ngDiplomacyRepository.updateById(proposal._id, {
        'data.status': ProposalStatus.ACCEPTED,
        'data.state': 'activated',
        'data.acceptedAt': new Date(),
        'data.acceptorGeneralId': acceptorGeneralId
      });

      return {
        success: true,
        reason: '종전에 합의했습니다.',
        newState: DiplomacyState.PEACE,
        term: 0
      };
    } catch (error) {
      console.error('[DiplomacyProposalService] acceptPeace error:', error);
      return { success: false, reason: '종전 수락 처리 중 오류가 발생했습니다.' };
    }
  }

  // ============================================
  // 공통 메서드
  // ============================================

  /**
   * 제안 거절
   */
  static async declineProposal(
    sessionId: string,
    proposalId: string | number,
    declinerId: number,
    reason?: string
  ): Promise<{ success: boolean; reason: string }> {
    try {
      const proposal = await ngDiplomacyRepository.findByLetterNo(sessionId, proposalId);

      if (!proposal) {
        return { success: false, reason: '외교 서신을 찾을 수 없습니다.' };
      }

      const proposalData = proposal.data || {};

      if (proposalData.status !== ProposalStatus.PENDING) {
        return { success: false, reason: '이미 처리된 제안입니다.' };
      }

      // 유효기간 확인
      if (proposalData.validUntil && new Date(proposalData.validUntil) < new Date()) {
        return { success: false, reason: '제안 유효기간이 만료되었습니다.' };
      }

      await ngDiplomacyRepository.updateById(proposal._id, {
        'data.status': ProposalStatus.DECLINED,
        'data.state': 'cancelled',
        'data.declinedAt': new Date(),
        'data.declinerId': declinerId,
        'data.declineReason': reason
      });

      const typeName = DiplomacyProposalTypeName[proposalData.type as DiplomacyProposalType] || '외교';
      return { success: true, reason: `${typeName} 제안을 거절했습니다.` };
    } catch (error) {
      console.error('[DiplomacyProposalService] declineProposal error:', error);
      return { success: false, reason: '제안 거절 처리 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 대기 중인 제안 목록 조회
   */
  static async getPendingProposals(
    sessionId: string,
    nationId: number
  ): Promise<any[]> {
    try {
      const proposals = await ngDiplomacyRepository.findByFilter({
        session_id: sessionId,
        'data.destNationId': nationId,
        'data.status': ProposalStatus.PENDING,
        'data.type': { $in: Object.values(DiplomacyProposalType) }
      });

      // 유효기간이 지난 제안 필터링
      const now = new Date();
      return proposals.filter((p: any) => {
        const validUntil = p.data?.validUntil;
        return !validUntil || new Date(validUntil) > now;
      });
    } catch (error) {
      console.error('[DiplomacyProposalService] getPendingProposals error:', error);
      return [];
    }
  }

  /**
   * 만료된 제안 정리
   */
  static async cleanupExpiredProposals(sessionId: string): Promise<number> {
    try {
      const now = new Date();
      const result = await ngDiplomacyRepository.updateMany(
        {
          session_id: sessionId,
          'data.status': ProposalStatus.PENDING,
          'data.validUntil': { $lt: now }
        },
        {
          'data.status': ProposalStatus.EXPIRED,
          'data.state': 'expired'
        }
      );

      return result.modifiedCount || 0;
    } catch (error) {
      console.error('[DiplomacyProposalService] cleanupExpiredProposals error:', error);
      return 0;
    }
  }

  /**
   * 제안 유효성 검증
   */
  private static validateProposal(
    proposalData: any,
    expectedType: DiplomacyProposalType
  ): { valid: boolean; reason?: string } {
    // 상태 검증
    if (proposalData.status !== ProposalStatus.PENDING && proposalData.status !== 'pending') {
      return { valid: false, reason: '이미 처리된 제안입니다.' };
    }

    // 타입 검증
    if (proposalData.type !== expectedType) {
      return { valid: false, reason: '제안 타입이 일치하지 않습니다.' };
    }

    // 유효기간 검증
    if (proposalData.validUntil && new Date(proposalData.validUntil) < new Date()) {
      return { valid: false, reason: '제안 유효기간이 만료되었습니다.' };
    }

    return { valid: true };
  }
}



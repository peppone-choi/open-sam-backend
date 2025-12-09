/**
 * Tribute.service.ts - 조공 시스템 서비스
 *
 * 국가 간 조공 요청/수락/거부를 담당합니다.
 */

import { nationRepository } from '../../repositories/nation.repository';
import { generalRepository } from '../../repositories/general.repository';
import { diplomacyRepository } from '../../repositories/diplomacy.repository';
import { logger } from '../../common/logger';
import { ActionLogger } from '../../utils/ActionLogger';

/**
 * 조공 요청 상태
 */
export enum TributeStatus {
  PENDING = 'pending',     // 대기
  ACCEPTED = 'accepted',   // 수락
  REJECTED = 'rejected',   // 거부
  EXPIRED = 'expired',     // 만료
  CANCELLED = 'cancelled', // 취소
}

/**
 * 조공 요청 인터페이스
 */
export interface TributeRequest {
  id: string;
  sessionId: string;
  fromNationId: number;      // 요청국
  toNationId: number;        // 대상국
  goldAmount: number;        // 금 요구량
  riceAmount: number;        // 쌀 요구량
  status: TributeStatus;
  createdAt: Date;
  expiresAt: Date;
  respondedAt?: Date;
  reason?: string;
}

/**
 * 조공 서비스 클래스
 */
export class TributeService {
  /**
   * 조공 요청
   */
  static async requestTribute(
    sessionId: string,
    fromNationId: number,
    toNationId: number,
    goldAmount: number,
    riceAmount: number,
    requesterId: number,
    year: number,
    month: number
  ): Promise<{ success: boolean; error?: string; requestId?: string }> {
    try {
      // 자국에게 조공 요청 불가
      if (fromNationId === toNationId) {
        return { success: false, error: '자국에게 조공을 요청할 수 없습니다.' };
      }

      // 금/쌀 최소 요구량 체크
      if (goldAmount <= 0 && riceAmount <= 0) {
        return { success: false, error: '조공 요구량은 0보다 커야 합니다.' };
      }

      // 두 국가 존재 확인
      const [fromNation, toNation] = await Promise.all([
        nationRepository.findBySessionAndNationId(sessionId, fromNationId),
        nationRepository.findBySessionAndNationId(sessionId, toNationId),
      ]);

      if (!fromNation || !toNation) {
        return { success: false, error: '존재하지 않는 국가입니다.' };
      }

      // 외교 상태 확인 (동맹국에게는 조공 요청 불가)
      const diplomacy = await diplomacyRepository.findRelation(sessionId, fromNationId, toNationId);
      if (diplomacy?.state === 2) { // 동맹
        return { success: false, error: '동맹국에게는 조공을 요청할 수 없습니다.' };
      }

      // 기존 대기 중인 조공 요청 확인
      const existingRequest = await diplomacyRepository.findTributeRequest(
        sessionId, fromNationId, toNationId, TributeStatus.PENDING
      );
      if (existingRequest) {
        return { success: false, error: '이미 대기 중인 조공 요청이 있습니다.' };
      }

      // 조공 요청 생성
      const requestId = `tribute_${Date.now()}_${fromNationId}_${toNationId}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 3); // 3일 후 만료

      const tributeRequest: TributeRequest = {
        id: requestId,
        sessionId,
        fromNationId,
        toNationId,
        goldAmount,
        riceAmount,
        status: TributeStatus.PENDING,
        createdAt: new Date(),
        expiresAt,
      };

      await diplomacyRepository.createTributeRequest(tributeRequest);

      // 로그 기록
      const fromNationName = fromNation.name || `국가${fromNationId}`;
      const toNationName = toNation.name || `국가${toNationId}`;

      const actionLogger = new ActionLogger(requesterId, fromNationId, year, month);
      actionLogger.pushGlobalHistoryLog(
        `<Y>${fromNationName}</>이(가) <Y>${toNationName}</>에게 조공을 요구했습니다. (금 ${goldAmount.toLocaleString()}, 쌀 ${riceAmount.toLocaleString()})`
      );
      await actionLogger.flush();

      logger.info('[Tribute] Request created', {
        sessionId,
        requestId,
        fromNationId,
        toNationId,
        goldAmount,
        riceAmount,
      });

      return { success: true, requestId };
    } catch (error: any) {
      logger.error('[Tribute] Request failed', {
        sessionId,
        fromNationId,
        toNationId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * 조공 수락
   */
  static async acceptTribute(
    sessionId: string,
    requestId: string,
    responderId: number,
    year: number,
    month: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const request = await diplomacyRepository.findTributeRequestById(sessionId, requestId);
      if (!request) {
        return { success: false, error: '조공 요청을 찾을 수 없습니다.' };
      }

      if (request.status !== TributeStatus.PENDING) {
        return { success: false, error: '이미 처리된 조공 요청입니다.' };
      }

      if (new Date() > request.expiresAt) {
        await diplomacyRepository.updateTributeRequest(sessionId, requestId, {
          status: TributeStatus.EXPIRED,
        });
        return { success: false, error: '만료된 조공 요청입니다.' };
      }

      // 대상국 자원 확인
      const toNation = await nationRepository.findBySessionAndNationId(sessionId, request.toNationId);
      if (!toNation) {
        return { success: false, error: '국가 정보를 찾을 수 없습니다.' };
      }

      const nationGold = toNation.gold || 0;
      const nationRice = toNation.rice || 0;

      if (nationGold < request.goldAmount || nationRice < request.riceAmount) {
        return { success: false, error: '자원이 부족합니다.' };
      }

      // 자원 이전
      await nationRepository.updateBySessionAndNationId(sessionId, request.toNationId, {
        $inc: {
          gold: -request.goldAmount,
          rice: -request.riceAmount,
        },
      });

      await nationRepository.updateBySessionAndNationId(sessionId, request.fromNationId, {
        $inc: {
          gold: request.goldAmount,
          rice: request.riceAmount,
        },
      });

      // 요청 상태 업데이트
      await diplomacyRepository.updateTributeRequest(sessionId, requestId, {
        status: TributeStatus.ACCEPTED,
        respondedAt: new Date(),
      });

      // 로그 기록
      const [fromNation, updatedToNation] = await Promise.all([
        nationRepository.findBySessionAndNationId(sessionId, request.fromNationId),
        nationRepository.findBySessionAndNationId(sessionId, request.toNationId),
      ]);

      const fromNationName = fromNation?.name || `국가${request.fromNationId}`;
      const toNationName = updatedToNation?.name || `국가${request.toNationId}`;

      const actionLogger = new ActionLogger(responderId, request.toNationId, year, month);
      actionLogger.pushGlobalHistoryLog(
        `<Y>${toNationName}</>이(가) <Y>${fromNationName}</>에게 조공을 바쳤습니다.`
      );
      await actionLogger.flush();

      logger.info('[Tribute] Accepted', {
        sessionId,
        requestId,
        fromNationId: request.fromNationId,
        toNationId: request.toNationId,
      });

      return { success: true };
    } catch (error: any) {
      logger.error('[Tribute] Accept failed', {
        sessionId,
        requestId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * 조공 거부
   */
  static async rejectTribute(
    sessionId: string,
    requestId: string,
    responderId: number,
    reason: string,
    year: number,
    month: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const request = await diplomacyRepository.findTributeRequestById(sessionId, requestId);
      if (!request) {
        return { success: false, error: '조공 요청을 찾을 수 없습니다.' };
      }

      if (request.status !== TributeStatus.PENDING) {
        return { success: false, error: '이미 처리된 조공 요청입니다.' };
      }

      // 요청 상태 업데이트
      await diplomacyRepository.updateTributeRequest(sessionId, requestId, {
        status: TributeStatus.REJECTED,
        respondedAt: new Date(),
        reason,
      });

      // 로그 기록
      const [fromNation, toNation] = await Promise.all([
        nationRepository.findBySessionAndNationId(sessionId, request.fromNationId),
        nationRepository.findBySessionAndNationId(sessionId, request.toNationId),
      ]);

      const fromNationName = fromNation?.name || `국가${request.fromNationId}`;
      const toNationName = toNation?.name || `국가${request.toNationId}`;

      const actionLogger = new ActionLogger(responderId, request.toNationId, year, month);
      actionLogger.pushGlobalHistoryLog(
        `<Y>${toNationName}</>이(가) <Y>${fromNationName}</>의 조공 요구를 거부했습니다!`
      );
      await actionLogger.flush();

      logger.info('[Tribute] Rejected', {
        sessionId,
        requestId,
        fromNationId: request.fromNationId,
        toNationId: request.toNationId,
        reason,
      });

      return { success: true };
    } catch (error: any) {
      logger.error('[Tribute] Reject failed', {
        sessionId,
        requestId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * 대기 중인 조공 요청 목록 조회 (받은 요청)
   */
  static async getPendingRequests(
    sessionId: string,
    nationId: number
  ): Promise<TributeRequest[]> {
    try {
      return await diplomacyRepository.findTributeRequestsByTarget(
        sessionId, nationId, TributeStatus.PENDING
      );
    } catch (error: any) {
      logger.error('[Tribute] Get pending requests failed', {
        sessionId,
        nationId,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * 만료된 조공 요청 정리
   */
  static async cleanupExpiredRequests(sessionId: string): Promise<number> {
    try {
      const now = new Date();
      const result = await diplomacyRepository.expireTributeRequests(sessionId, now);
      const count = result.modifiedCount;
      
      if (count > 0) {
        logger.info('[Tribute] Expired requests cleaned up', {
          sessionId,
          count,
        });
      }

      return count;
    } catch (error: any) {
      logger.error('[Tribute] Cleanup failed', {
        sessionId,
        error: error.message,
      });
      return 0;
    }
  }
}

export default TributeService;






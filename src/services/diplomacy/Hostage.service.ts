/**
 * Hostage.service.ts - 인질 시스템 서비스
 *
 * 국가 간 인질 교환/탈출을 담당합니다.
 */

import { nationRepository } from '../../repositories/nation.repository';
import { generalRepository } from '../../repositories/general.repository';
import { diplomacyRepository } from '../../repositories/diplomacy.repository';
import { logger } from '../../common/logger';
import { ActionLogger } from '../../utils/ActionLogger';
import { RandUtil } from '../../utils/RandUtil';
import { LiteHashDRBG } from '../../utils/LiteHashDRBG';

/**
 * 인질 상태
 */
export enum HostageStatus {
  ACTIVE = 'active',         // 활성 인질
  RETURNED = 'returned',     // 반환됨
  ESCAPED = 'escaped',       // 탈출
  DEAD = 'dead',             // 사망
  EXECUTED = 'executed',     // 처형됨
}

/**
 * 인질 정보 인터페이스
 */
export interface HostageInfo {
  id: string;
  sessionId: string;
  generalId: number;         // 인질 장수 ID
  originalNationId: number;  // 원래 소속 국가
  hostNationId: number;      // 인질을 보유한 국가
  status: HostageStatus;
  sentAt: Date;
  returnedAt?: Date;
  reason?: string;
}

/**
 * 인질 교환 요청
 */
export interface HostageExchangeRequest {
  id: string;
  sessionId: string;
  fromNationId: number;
  toNationId: number;
  fromHostageId: string;     // 요청국이 보내는 인질
  toHostageId?: string;      // 대상국이 보내는 인질 (선택적)
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: Date;
  expiresAt: Date;
}

/**
 * 인질 서비스 클래스
 */
export class HostageService {
  /**
   * 인질 보내기 (불가침/동맹 조건)
   */
  static async sendHostage(
    sessionId: string,
    fromNationId: number,
    toNationId: number,
    generalId: number,
    senderId: number,
    year: number,
    month: number
  ): Promise<{ success: boolean; error?: string; hostageId?: string }> {
    try {
      // 자국에게 인질 불가
      if (fromNationId === toNationId) {
        return { success: false, error: '자국에게 인질을 보낼 수 없습니다.' };
      }

      // 장수 확인
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);
      if (!general) {
        return { success: false, error: '장수를 찾을 수 없습니다.' };
      }

      const generalNationId = general.data?.nation || general.nation || 0;
      if (generalNationId !== fromNationId) {
        return { success: false, error: '자국 장수만 인질로 보낼 수 있습니다.' };
      }

      // 군주는 인질 불가
      const nation = await nationRepository.findBySessionAndNationId(sessionId, fromNationId);
      if (nation?.lord === generalId) {
        return { success: false, error: '군주는 인질로 보낼 수 없습니다.' };
      }

      // 이미 인질 상태인지 확인
      if (general.data?.hostage_to || general.hostage_to) {
        return { success: false, error: '이미 인질 상태인 장수입니다.' };
      }

      // 대상국 존재 확인
      const toNation = await nationRepository.findBySessionAndNationId(sessionId, toNationId);
      if (!toNation) {
        return { success: false, error: '대상 국가를 찾을 수 없습니다.' };
      }

      // 인질 ID 생성
      const hostageId = `hostage_${Date.now()}_${generalId}`;

      // 인질 정보 저장
      const hostageInfo: HostageInfo = {
        id: hostageId,
        sessionId,
        generalId,
        originalNationId: fromNationId,
        hostNationId: toNationId,
        status: HostageStatus.ACTIVE,
        sentAt: new Date(),
      };

      await diplomacyRepository.createHostage(hostageInfo);

      // 장수 상태 업데이트
      const generalData = general.data || {};
      generalData.hostage_to = toNationId;
      generalData.hostage_id = hostageId;

      await generalRepository.updateBySessionAndNo(sessionId, generalId, {
        data: generalData,
      });

      // 로그 기록
      const fromNationName = nation?.name || `국가${fromNationId}`;
      const toNationName = toNation.name || `국가${toNationId}`;
      const generalName = general.data?.name || general.name || `장수${generalId}`;

      const actionLogger = new ActionLogger(senderId, fromNationId, year, month);
      actionLogger.pushGlobalHistoryLog(
        `<Y>${fromNationName}</>이(가) <Y>${generalName}</>을(를) <Y>${toNationName}</>에 인질로 보냈습니다.`
      );
      await actionLogger.flush();

      logger.info('[Hostage] Sent', {
        sessionId,
        hostageId,
        generalId,
        fromNationId,
        toNationId,
      });

      return { success: true, hostageId };
    } catch (error: any) {
      logger.error('[Hostage] Send failed', {
        sessionId,
        generalId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * 인질 반환
   */
  static async returnHostage(
    sessionId: string,
    hostageId: string,
    returnerId: number,
    year: number,
    month: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const hostage = await diplomacyRepository.findHostageById(sessionId, hostageId);
      if (!hostage) {
        return { success: false, error: '인질 정보를 찾을 수 없습니다.' };
      }

      if (hostage.status !== HostageStatus.ACTIVE) {
        return { success: false, error: '활성 상태의 인질만 반환할 수 있습니다.' };
      }

      // 장수 상태 업데이트
      const general = await generalRepository.findBySessionAndNo(sessionId, hostage.generalId);
      if (general) {
        const generalData = general.data || {};
        delete generalData.hostage_to;
        delete generalData.hostage_id;

        await generalRepository.updateBySessionAndNo(sessionId, hostage.generalId, {
          data: generalData,
        });
      }

      // 인질 상태 업데이트
      await diplomacyRepository.updateHostage(sessionId, hostageId, {
        status: HostageStatus.RETURNED,
        returnedAt: new Date(),
      });

      // 로그 기록
      const [originalNation, hostNation] = await Promise.all([
        nationRepository.findBySessionAndNationId(sessionId, hostage.originalNationId),
        nationRepository.findBySessionAndNationId(sessionId, hostage.hostNationId),
      ]);

      const originalNationName = originalNation?.name || `국가${hostage.originalNationId}`;
      const hostNationName = hostNation?.name || `국가${hostage.hostNationId}`;
      const generalName = general?.data?.name || general?.name || `장수${hostage.generalId}`;

      const actionLogger = new ActionLogger(returnerId, hostage.hostNationId, year, month);
      actionLogger.pushGlobalHistoryLog(
        `<Y>${hostNationName}</>이(가) <Y>${generalName}</>을(를) <Y>${originalNationName}</>에 반환했습니다.`
      );
      await actionLogger.flush();

      logger.info('[Hostage] Returned', {
        sessionId,
        hostageId,
        generalId: hostage.generalId,
      });

      return { success: true };
    } catch (error: any) {
      logger.error('[Hostage] Return failed', {
        sessionId,
        hostageId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * 인질 탈출 시도
   */
  static async attemptEscape(
    sessionId: string,
    hostageId: string,
    year: number,
    month: number
  ): Promise<{ success: boolean; escaped: boolean; error?: string }> {
    try {
      const hostage = await diplomacyRepository.findHostageById(sessionId, hostageId);
      if (!hostage) {
        return { success: false, escaped: false, error: '인질 정보를 찾을 수 없습니다.' };
      }

      if (hostage.status !== HostageStatus.ACTIVE) {
        return { success: false, escaped: false, error: '활성 상태의 인질만 탈출을 시도할 수 있습니다.' };
      }

      const general = await generalRepository.findBySessionAndNo(sessionId, hostage.generalId);
      if (!general) {
        return { success: false, escaped: false, error: '장수 정보를 찾을 수 없습니다.' };
      }

      // 탈출 확률 계산 (지력 기반)
      const intel = general.data?.intel || general.intel || 50;
      const baseEscapeChance = 0.05; // 기본 5%
      const intelBonus = (intel - 50) / 1000; // 지력 50 기준, 100이면 +5%
      const escapeChance = Math.min(0.20, Math.max(0.02, baseEscapeChance + intelBonus));

      const rng = new RandUtil(new LiteHashDRBG(`escape_${hostageId}_${year}_${month}`));
      const escaped = rng.nextBool(escapeChance);

      if (escaped) {
        // 탈출 성공
        const generalData = general.data || {};
        delete generalData.hostage_to;
        delete generalData.hostage_id;

        await generalRepository.updateBySessionAndNo(sessionId, hostage.generalId, {
          data: generalData,
        });

        await diplomacyRepository.updateHostage(sessionId, hostageId, {
          status: HostageStatus.ESCAPED,
          returnedAt: new Date(),
          reason: '탈출 성공',
        });

        // 로그 기록
        const [originalNation, hostNation] = await Promise.all([
          nationRepository.findBySessionAndNationId(sessionId, hostage.originalNationId),
          nationRepository.findBySessionAndNationId(sessionId, hostage.hostNationId),
        ]);

        const generalName = general.data?.name || general.name || `장수${hostage.generalId}`;
        const hostNationName = hostNation?.name || `국가${hostage.hostNationId}`;

        const actionLogger = new ActionLogger(hostage.generalId, hostage.originalNationId, year, month);
        actionLogger.pushGlobalHistoryLog(
          `<Y>${generalName}</>이(가) <Y>${hostNationName}</>에서 탈출했습니다!`
        );
        await actionLogger.flush();

        logger.info('[Hostage] Escaped', {
          sessionId,
          hostageId,
          generalId: hostage.generalId,
        });
      }

      return { success: true, escaped };
    } catch (error: any) {
      logger.error('[Hostage] Escape attempt failed', {
        sessionId,
        hostageId,
        error: error.message,
      });
      return { success: false, escaped: false, error: error.message };
    }
  }

  /**
   * 인질 처형
   */
  static async executeHostage(
    sessionId: string,
    hostageId: string,
    executorId: number,
    year: number,
    month: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const hostage = await diplomacyRepository.findHostageById(sessionId, hostageId);
      if (!hostage) {
        return { success: false, error: '인질 정보를 찾을 수 없습니다.' };
      }

      if (hostage.status !== HostageStatus.ACTIVE) {
        return { success: false, error: '활성 상태의 인질만 처형할 수 있습니다.' };
      }

      // 장수 사망 처리
      const general = await generalRepository.findBySessionAndNo(sessionId, hostage.generalId);
      if (general) {
        const generalData = general.data || {};
        generalData.killturn = `${year}년 ${month}월`;
        generalData.death_reason = '인질 처형';
        delete generalData.hostage_to;
        delete generalData.hostage_id;

        await generalRepository.updateBySessionAndNo(sessionId, hostage.generalId, {
          data: generalData,
          npc: 5, // 사망 상태
        });
      }

      // 인질 상태 업데이트
      await diplomacyRepository.updateHostage(sessionId, hostageId, {
        status: HostageStatus.EXECUTED,
        returnedAt: new Date(),
        reason: '처형됨',
      });

      // 외교 관계 악화 (원래 국가와 적대)
      await diplomacyRepository.setRelation(
        sessionId,
        hostage.hostNationId,
        hostage.originalNationId,
        'hostile' // 적대
      );

      // 로그 기록
      const [originalNation, hostNation] = await Promise.all([
        nationRepository.findBySessionAndNationId(sessionId, hostage.originalNationId),
        nationRepository.findBySessionAndNationId(sessionId, hostage.hostNationId),
      ]);

      const generalName = general?.data?.name || general?.name || `장수${hostage.generalId}`;
      const originalNationName = originalNation?.name || `국가${hostage.originalNationId}`;
      const hostNationName = hostNation?.name || `국가${hostage.hostNationId}`;

      const actionLogger = new ActionLogger(executorId, hostage.hostNationId, year, month);
      actionLogger.pushGlobalHistoryLog(
        `<R><b>【처형】</b></> <Y>${hostNationName}</>이(가) <Y>${originalNationName}</>의 인질 <Y>${generalName}</>을(를) 처형했습니다!`
      );
      await actionLogger.flush();

      logger.info('[Hostage] Executed', {
        sessionId,
        hostageId,
        generalId: hostage.generalId,
        executorId,
      });

      return { success: true };
    } catch (error: any) {
      logger.error('[Hostage] Execute failed', {
        sessionId,
        hostageId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * 국가의 인질 목록 조회 (보유 중인 인질)
   */
  static async getHostages(
    sessionId: string,
    nationId: number
  ): Promise<HostageInfo[]> {
    try {
      return await diplomacyRepository.findHostagesByHost(sessionId, nationId, HostageStatus.ACTIVE);
    } catch (error: any) {
      logger.error('[Hostage] Get hostages failed', {
        sessionId,
        nationId,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * 국가에서 보낸 인질 목록 조회
   */
  static async getSentHostages(
    sessionId: string,
    nationId: number
  ): Promise<HostageInfo[]> {
    try {
      return await diplomacyRepository.findHostagesByOrigin(sessionId, nationId, HostageStatus.ACTIVE);
    } catch (error: any) {
      logger.error('[Hostage] Get sent hostages failed', {
        sessionId,
        nationId,
        error: error.message,
      });
      return [];
    }
  }
}

export default HostageService;






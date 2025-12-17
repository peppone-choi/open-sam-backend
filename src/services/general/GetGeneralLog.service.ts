import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { generalRecordRepository } from '../../repositories/general-record.repository';

/**
 * GetGeneralLog Service (장수 로그 조회)
 * 장수의 개인 기록 조회
 * - 본인 기록: 직접 조회
 * - 타인 기록 (열전): 감찰부에서 generalID 파라미터로 조회
 */
export class GetGeneralLogService {
  // PHP API와 동일한 타입 상수
  static readonly GENERAL_HISTORY = 'generalHistory';
  static readonly GENERAL_ACTION = 'generalAction';
  static readonly BATTLE_RESULT = 'battleResult';
  static readonly BATTLE_DETAIL = 'battleDetail';

  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    
    // ✅ 감찰부에서 다른 장수 열전 조회 지원
    // generalID 파라미터가 있으면 해당 장수, 없으면 본인
    const targetGeneralId = data.generalID || data.general_id || user?.generalId;

    try {
      // 1. 입력 검증
      const { reqType, reqTo } = data;

      if (!reqType) {
        return {
          success: false,
          message: '조회 유형 값이 필요합니다.'
        };
      }

      // PHP와 동일한 타입만 허용
      const validTypes = [
        this.GENERAL_HISTORY,
        this.GENERAL_ACTION,
        this.BATTLE_RESULT,
        this.BATTLE_DETAIL
      ];

      if (!validTypes.includes(reqType)) {
        return {
          success: false,
          message: `지원하지 않는 조회 유형입니다: ${reqType}. 가능한 값: ${validTypes.join(', ')}`
        };
      }

      // 2. 장수 ID 확인
      if (!targetGeneralId) {
        return {
          success: false,
          message: '장수 ID가 필요합니다'
        };
      }
      
      const generalId = Number(targetGeneralId);

      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);

      if (!general) {
        return {
          success: false,
          message: '장수를 찾을 수 없습니다'
        };
      }

      // 3. 로그 타입에 따라 조회
      let logs: any[] = [];

      if (reqType === this.GENERAL_HISTORY) {
        // 장수 역사 (중요 이벤트)
        logs = await this.getGeneralHistoryLog(sessionId, generalId);
      } else if (reqType === this.GENERAL_ACTION) {
        // 장수 행동 로그
        logs = await this.getGeneralActionLog(sessionId, generalId, reqTo);
      } else if (reqType === this.BATTLE_RESULT) {
        // 전투 결과 로그
        logs = await this.getBattleResultLog(sessionId, generalId, reqTo);
      } else if (reqType === this.BATTLE_DETAIL) {
        // 전투 상세 로그
        logs = await this.getBattleDetailLog(sessionId, generalId, reqTo);
      }

      return {
        success: true,
        result: true,
        reqType,
        generalID: generalId,
        log: logs,      // 기존 호환
        logs: logs,     // ✅ 프론트엔드 호환 (감찰부 등)
      };

    } catch (error: any) {
      console.error('GetGeneralLog error:', error);
      return {
        success: false,
        message: error.message || '로그 조회 중 오류가 발생했습니다'
      };
    }
  }

  /**
   * 장수 열전 (History) 조회
   * 탄생/사망 등 주요 이벤트 이력
   */
  private static async getGeneralHistoryLog(
    sessionId: string,
    generalId: number
  ): Promise<any[]> {
      const logs = await generalRecordRepository.findByFilter({
        session_id: sessionId,
        general_id: generalId,
        log_type: 'history'
      }, {

      sort: { _id: -1 },
      limit: 100
    });

    return logs.map((log: any) => ({
      id: log._id,
      year: log.year,
      month: log.month,
      text: log.text,
      date: log.date
    }));
  }

  /**
   * 장수 행동 로그 (Action) 조회
   * 매 턴마다 실행한 커맨드 결과
   */
  private static async getGeneralActionLog(
    sessionId: string,
    generalId: number,
    reqTo?: number
  ): Promise<any[]> {
    const limit = 30;
      let query: any = {
      session_id: sessionId,
      general_id: generalId,
      log_type: 'action'
    };

    if (reqTo) {
      query._id = { $lt: reqTo };
    }

    const logs = await generalRecordRepository.findByFilter(query, {
      sort: { _id: -1 },
      limit
    });

    return logs.map((log: any) => ({
      id: log._id,
      year: log.year,
      month: log.month,
      text: log.text,
      date: log.date
    }));
  }

  /**
   * 전투 결과 로그 조회
   * PHP: log_type='battle_brief' (getBattleResultRecent/getBattleResultMore)
   */
  private static async getBattleResultLog(
    sessionId: string,
    generalId: number,
    reqTo?: number
  ): Promise<any[]> {
    const limit = 30;
    let query: any = {
      session_id: sessionId,
      general_id: generalId,
      log_type: 'battle_brief'  // ✅ PHP와 동일
    };

    if (reqTo) {
      query._id = { $lt: reqTo };
    }

    const logs = await generalRecordRepository.findByFilter(query, {
      sort: { _id: -1 },
      limit
    });

    return logs.map((log: any) => ({
      id: log._id,
      year: log.year,
      month: log.month,
      text: log.text,
      date: log.date
    }));
  }

  /**
   * 전투 상세 로그 조회
   * PHP: log_type='battle' (getBattleDetailLogRecent/getBattleDetailLogMore)
   */
  private static async getBattleDetailLog(
    sessionId: string,
    generalId: number,
    reqTo?: number
  ): Promise<any[]> {
    const limit = 30;
    let query: any = {
      session_id: sessionId,
      general_id: generalId,
      log_type: 'battle'  // ✅ PHP와 동일
    };

    if (reqTo) {
      query._id = { $lt: reqTo };
    }

    const logs = await generalRecordRepository.findByFilter(query, {
      sort: { _id: -1 },
      limit
    });

    return logs.map((log: any) => ({
      id: log._id,
      year: log.year,
      month: log.month,
      text: log.text,
      date: log.date,
      detail: log.data || {}
    }));
  }
}
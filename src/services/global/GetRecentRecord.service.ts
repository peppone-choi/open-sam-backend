import { generalRecordRepository } from '../../repositories/general-record.repository';
import { worldHistoryRepository } from '../../repositories/world-history.repository';
import { sessionRepository } from '../../repositories/session.repository';

/**
 * GetRecentRecord Service
 * 최근 기록을 반환합니다 (전체 역사, 전역 기록, 개인 기록)
 * 
 * PHP 버전과의 매핑:
 * - history (중원정세): world_history에서 nation_id=0 (전역 세계 역사)
 * - global (장수동향): general_record에서 general_id=0, log_type='history' (전역 장수동향)
 * - general (개인기록): general_record에서 general_id=장수ID, log_type='action' (개인 행동 기록)
 */
export class GetRecentRecordService {
  private static readonly ROW_LIMIT = 15;

  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const lastWorldHistoryID = data.lastWorldHistoryID || '';
    const lastGeneralRecordID = data.lastGeneralRecordID || '';
    
    try {
      // Load session
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session) {
        return {
          success: false,
          message: '세션을 찾을 수 없습니다.'
        };
      }

      // Get recent records
      const history = await this.getHistory(sessionId, lastWorldHistoryID);
      const globalRecord = await this.getGlobalRecord(sessionId, lastGeneralRecordID);
      const generalRecord = await this.getGeneralRecord(sessionId, generalId, lastGeneralRecordID);

      // Determine flush flags
      let flushHistory = false;
      let flushGlobalRecord = false;
      let flushGeneralRecord = false;

      // Process history - ID 비교로 flush 여부 결정
      if (history.length === 0) {
        flushHistory = false;
      } else if (lastWorldHistoryID && history[history.length - 1][0] === lastWorldHistoryID) {
        flushHistory = false;
        history.pop();
      } else if (history.length > this.ROW_LIMIT) {
        history.pop();
      }

      // Process global record
      if (globalRecord.length === 0) {
        flushGlobalRecord = false;
      } else if (lastGeneralRecordID && globalRecord[globalRecord.length - 1][0] === lastGeneralRecordID) {
        flushGlobalRecord = false;
        globalRecord.pop();
      } else if (globalRecord.length > this.ROW_LIMIT) {
        globalRecord.pop();
      }

      // Process general record
      if (generalRecord.length === 0) {
        flushGeneralRecord = false;
      } else if (lastGeneralRecordID && generalRecord[generalRecord.length - 1][0] === lastGeneralRecordID) {
        flushGeneralRecord = false;
        generalRecord.pop();
      } else if (generalRecord.length > this.ROW_LIMIT) {
        generalRecord.pop();
      }

      return {
        success: true,
        result: true,
        history,
        global: globalRecord,
        general: generalRecord,
        flushHistory: flushHistory ? 1 : 0,
        flushGlobal: flushGlobalRecord ? 1 : 0,
        flushGeneral: flushGeneralRecord ? 1 : 0
      };
    } catch (error: any) {
      console.error('GetRecentRecord error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 중원정세 (history) - world_history에서 nation_id=0 (PHP: getHistory)
   */
  private static async getHistory(sessionId: string, lastHistoryID: string): Promise<any[]> {
    const filter: any = {
      session_id: sessionId,
      nation_id: 0  // 전역 세계 역사
    };
    
    if (lastHistoryID) {
      filter._id = { $gte: lastHistoryID };
    }
    
    const records = await worldHistoryRepository.findByFilter(filter)
      .sort({ _id: -1 })
      .limit(this.ROW_LIMIT + 1)
      .lean();

    return records.map((record: any) => [record._id?.toString(), record.text]);
  }

  /**
   * 장수동향 (global) - general_record에서 general_id=0, log_type='history' (PHP: getGlobalRecord)
   */
  private static async getGlobalRecord(sessionId: string, lastRecordID: string): Promise<any[]> {
    const filter: any = {
      session_id: sessionId,
      general_id: 0,
      log_type: 'history'
    };
    
    if (lastRecordID) {
      filter._id = { $gte: lastRecordID };
    }
    
    const records = await generalRecordRepository.findByFilter(filter, {
      sort: { _id: -1 },
      limit: this.ROW_LIMIT + 1
    });

    return records.map((record: any) => [record._id?.toString() || record.id, record.text]);
  }

  /**
   * 개인기록 (general) - general_record에서 general_id=장수ID, log_type='action' (PHP: getGeneralRecord)
   */
  private static async getGeneralRecord(sessionId: string, generalId: number, lastRecordID: string): Promise<any[]> {
    if (!generalId) {
      return [];
    }

    const filter: any = {
      session_id: sessionId,
      general_id: generalId,
      log_type: 'action'
    };
    
    if (lastRecordID) {
      filter._id = { $gte: lastRecordID };
    }
    
    const records = await generalRecordRepository.findByFilter(filter, {
      sort: { _id: -1 },
      limit: this.ROW_LIMIT + 1
    });

    return records.map((record: any) => [record._id?.toString() || record.id, record.text]);
  }
}

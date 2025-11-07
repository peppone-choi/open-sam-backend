import { generalRepository } from '../../repositories/general.repository';
import { generalRecordRepository } from '../../repositories/general-record.repository';
import { worldHistoryRepository } from '../../repositories/world-history.repository';
import { sessionRepository } from '../../repositories/session.repository';

/**
 * GetRecentRecord Service
 * 최근 기록을 반환합니다 (전체 역사, 전역 기록, 개인 기록)
 */
export class GetRecentRecordService {
  private static readonly ROW_LIMIT = 15;

  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const lastWorldHistoryID = parseInt(data.lastWorldHistoryID || '0') || 0;
    const lastGeneralRecordID = parseInt(data.lastGeneralRecordID || '0') || 0;
    
    try {
      // Load session
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          success: false,
          message: 'Session not found'
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

      // Process history
      if (history.length === 0) {
        flushHistory = false;
      } else if (history[history.length - 1][0] <= lastWorldHistoryID) {
        flushHistory = false;
        history.pop();
      } else if (history.length > this.ROW_LIMIT) {
        history.pop();
      }

      // Process global record
      if (globalRecord.length === 0) {
        flushGlobalRecord = false;
      } else if (globalRecord[globalRecord.length - 1][0] === lastGeneralRecordID) {
        flushGlobalRecord = false;
        globalRecord.pop();
      } else if (globalRecord.length > this.ROW_LIMIT) {
        globalRecord.pop();
      }

      // Process general record
      if (generalRecord.length === 0) {
        flushGeneralRecord = false;
      } else if (generalRecord[generalRecord.length - 1][0] === lastGeneralRecordID) {
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
   * Get world history records
   */
  private static async getHistory(sessionId: string, lastHistoryID: number): Promise<any[]> {
    const records = await worldHistoryRepository.findByFilter({
      session_id: sessionId,
      'data.nation_id': 0,
      'data.id': { $gte: lastHistoryID }
    })
      
      .sort({ 'data.id': -1 })
      .limit(this.ROW_LIMIT + 1)
      ;

    return records.map(record => {
      const data = record.data as any;
      return [data.id, data.text];
    });
  }

  /**
   * Get global records (general_id = 0, log_type = 'history')
   */
  private static async getGlobalRecord(sessionId: string, lastRecordID: number): Promise<any[]> {
    const records = await generalRecordRepository.findByFilter({
      session_id: sessionId,
      'data.general_id': 0,
      'data.log_type': 'history',
      'data.id': { $gte: lastRecordID }
    })
      
      .sort({ 'data.id': -1 })
      .limit(this.ROW_LIMIT + 1)
      ;

    return records.map(record => {
      const data = record.data as any;
      return [data.id, data.text];
    });
  }

  /**
   * Get general's action records
   */
  private static async getGeneralRecord(sessionId: string, generalId: number, lastRecordID: number): Promise<any[]> {
    if (!generalId) {
      return [];
    }

    const records = await generalRecordRepository.findByFilter({
      session_id: sessionId,
      'data.general_id': generalId,
      'data.log_type': 'action',
      'data.id': { $gte: lastRecordID }
    })
      
      .sort({ 'data.id': -1 })
      .limit(this.ROW_LIMIT + 1)
      ;

    return records.map(record => {
      const data = record.data as any;
      return [data.id, data.text];
    });
  }
}

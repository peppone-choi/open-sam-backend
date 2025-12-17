import { generalRepository } from '../../repositories/general.repository';
import { GeneralRecord, IGeneralRecord } from '../../models/general_record.model';
import { Model } from 'mongoose';

/**
 * GetGeneralLogs Service
 * 장수의 행동/이력 로그 조회
 * 
 * PHP: func_history.php의 getGeneralHistoryLog, getGeneralActionLog 참고
 * general_records 컬렉션 사용 (PHP general_record 테이블과 호환)
 */
export class GetGeneralLogsService {
  static async execute(data: any, user?: any) {
    const sessionId = data.serverID || data.session_id || process.env.DEFAULT_SESSION_ID || 'sangokushi_default';
    const generalId = data.general_id || data.generalID;
    const logType = data.log_type || 'action'; // PHP와 동일: 'action' | 'history' | 'battle_brief' | 'battle'
    const limit = parseInt(data.limit) || 50;
    const year = data.year ? parseInt(data.year) : undefined;
    const month = data.month ? parseInt(data.month) : undefined;

    try {
      // 장수 존재 확인
      if (!generalId) {
        return {
          success: false,
          message: '장수 ID가 필요합니다'
        };
      }

      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);
      if (!general) {
        return {
          success: false,
          message: '장수를 찾을 수 없습니다'
        };
      }

      // 로그 조회 쿼리 작성
      const query: any = {
        session_id: sessionId,
        general_id: generalId,
      };

      // log_type 필터
      if (logType === 'all') {
        // 모든 타입 조회
      } else if (Array.isArray(logType)) {
        query.log_type = { $in: logType };
      } else {
        query.log_type = logType;
      }

      // 년/월 필터
      if (year !== undefined) {
        query.year = year;
      }
      if (month !== undefined) {
        query.month = month;
      }

      // 로그 조회 (최신순) - GeneralRecord 모델 사용
      const GeneralRecordModel = GeneralRecord as Model<IGeneralRecord>;
      const logs = await GeneralRecordModel.find(query)
        .sort({ created_at: -1, _id: -1 })
        .limit(limit)
        .lean();

      return {
        success: true,
        result: true,
        logs: logs.map((log: any) => ({
          id: log._id,
          general_id: log.general_id,
          log_type: log.log_type,
          year: log.year,
          month: log.month,
          text: log.text,
          created_at: log.created_at,
        })),
        total: logs.length,
        hasMore: logs.length >= limit,
      };
    } catch (error: any) {
      console.error('[GetGeneralLogs] Error:', error);
      return {
        success: false,
        message: error.message || '로그 조회 실패',
      };
    }
  }
}

// @ts-nocheck - Type issues need investigation
import { InheritActionRepository } from '../../repositories/inheritaction.repository';
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { UserRecord } from '../../models/user_record.model';

export class GetMoreLogService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    
    try {
      const { lastID } = data;
      
      if (typeof lastID !== 'number') {
        return { success: false, message: '잘못된 마지막 ID 파라미터입니다.' };
      }

      
      const logs = await UserRecord.find({
        session_id: sessionId,
        user_id: userId,
        log_type: 'inheritPoint',
        id: { $lt: lastID }
      })
      .sort({ id: -1 })
      .limit(30)
      
      ;
      
      return {
        success: true,
        result: true,
        log: logs,
        message: '추가 로그를 불러왔습니다.'

      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

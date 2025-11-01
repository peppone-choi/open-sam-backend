import { InheritActionRepository } from '../../repositories/inheritaction.repository';
import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';
import { UserRecord } from '../../models/user_record.model';

export class GetMoreLogService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    
    try {
      const { lastID } = data;
      
      if (typeof lastID !== 'number') {
        return { success: false, message: '잘못된 lastID 파라미터입니다.' };
      }
      
      const logs = await UserRecord.find({
        session_id: sessionId,
        user_id: userId,
        log_type: 'inheritPoint',
        id: { $lt: lastID }
      })
      .sort({ id: -1 })
      .limit(30)
      .select('id server_id year month date text')
      .lean();
      
      return {
        success: true,
        result: true,
        log: logs,
        message: 'GetMoreLog executed successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

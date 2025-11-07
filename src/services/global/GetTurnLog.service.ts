import { generalRecordRepository } from '../../repositories/general-record.repository';
import { sessionRepository } from '../../repositories/session.repository';

export class GetTurnLogService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const lastId = parseInt(data.last_id || '0') || 0;
    const limit = parseInt(data.limit || '50') || 50;
    
    try {
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          success: false,
          message: 'Session not found'
        };
      }

      if (!generalId) {
        return {
          success: false,
          message: 'General ID required'
        };
      }

      const query: any = {
        session_id: sessionId,
        'data.general_id': generalId,
        'data.log_type': 'turn'
      };

      if (lastId > 0) {
        query['data.id'] = { $lt: lastId };
      }

      const records = await generalRecordRepository.findByFilter(query)
        
        .sort({ 'data.id': -1 })
        .limit(limit)
        ;

      const logs = records.map(record => {
        const data = record.data as any;
        return {
          id: data.id,
          text: data.text,
          year: data.year,
          month: data.month,
          turn: data.turn
        };
      });

      return {
        success: true,
        result: true,
        logs
      };
    } catch (error: any) {
      console.error('GetTurnLog error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

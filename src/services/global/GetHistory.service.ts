import { sessionRepository } from '../../repositories/session.repository';
import { NgHistory } from '../../models/ng_history.model';
import mongoose from 'mongoose';

export class GetHistoryService {
  static async execute(data: any, _user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const year = parseInt(data.year) || 0;
    const month = parseInt(data.month) || 0;
    const serverID = data.serverID || 'sangokushi';
    
    try {
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          success: false,
          message: '세션을 찾을 수 없습니다.'
        };
      }

      // Mongoose 모델 사용 (히스토리는 로그 데이터이므로 DB 직접 조회 허용)
      const history = await (NgHistory as any).findOne({
        server_id: serverID,
        year: year,
        month: month
      });

      if (!history) {
        return {
          success: false,
          message: '요청한 연월의 기록이 없습니다.'
        };
      }

      const globalHistory = typeof history.global_history === 'string' 
        ? JSON.parse(history.global_history) 
        : history.global_history;
      
      const globalAction = typeof history.global_action === 'string'
        ? JSON.parse(history.global_action)
        : history.global_action;
      
      const nations = typeof history.nations === 'string'
        ? JSON.parse(history.nations)
        : history.nations;
      
      const map = typeof history.map === 'string'
        ? JSON.parse(history.map)
        : history.map;

      return {
        success: true,
        result: true,
        history: {
          server_id: history.server_id,
          year: history.year,
          month: history.month,
          global_history: globalHistory,
          global_action: globalAction,
          nations: nations,
          map: map
        }
      };
    } catch (error: any) {
      console.error('GetHistory error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

import { sessionRepository } from '../../repositories/session.repository';
import { NgHistory } from '../../models/ng_history.model';
import mongoose from 'mongoose';

export class GetHistoryService {
  static async execute(data: any, _user?: any) {
    const sessionId = data.session_id || data.serverID || 'sangokushi_default';
    const year = data.year ? parseInt(data.year) : undefined;
    const month = data.month ? parseInt(data.month) : undefined;
    // serverID는 sessionId와 동일하게 사용 (ng_history.server_id = sessionId)
    const serverID = sessionId;
    
    try {
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session) {
        return {
          success: false,
          message: '세션을 찾을 수 없습니다.'
        };
      }

      let history;
      
      // year/month가 없으면 최신 기록 반환
      if (!year || !month) {
        history = await (NgHistory as any).findOne({
          server_id: serverID
        }).sort({ year: -1, month: -1 });
      } else {
        // 특정 년/월 기록 조회
        history = await (NgHistory as any).findOne({
          server_id: serverID,
          year: year,
          month: month
        });
      }

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

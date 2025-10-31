import { Session } from '../../models/session.model';
import mongoose from 'mongoose';

export class GetHistoryService {
  static async execute(data: any, _user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const year = parseInt(data.year) || 0;
    const month = parseInt(data.month) || 0;
    const serverID = data.serverID || 'sangokushi';
    
    try {
      const session = await Session.findOne({ session_id: sessionId });
      if (!session) {
        return {
          success: false,
          message: 'Session not found'
        };
      }

      const db = mongoose.connection.db;
      if (!db) {
        return {
          success: false,
          message: 'Database connection unavailable'
        };
      }

      const historyCollection = db.collection('ng_historys');
      
      const history = await historyCollection.findOne({
        server_id: serverID,
        year: year,
        month: month
      });

      if (!history) {
        return {
          success: false,
          message: 'History not found for specified year/month'
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
        data: {
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

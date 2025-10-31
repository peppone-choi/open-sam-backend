import { Session } from '../../models/session.model';

export class CheckServerOnlineService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      const session = await Session.findOne({ session_id: sessionId });
      
      if (!session) {
        return {
          success: false,
          result: false,
          online: false,
          message: 'Session not found'
        };
      }

      return {
        success: true,
        result: true,
        online: true
      };
    } catch (error: any) {
      console.error('CheckServerOnline error:', error);
      return {
        success: false,
        result: false,
        online: false,
        message: error.message
      };
    }
  }
}

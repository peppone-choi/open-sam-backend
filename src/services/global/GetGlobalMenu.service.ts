import { Session } from '../../models/session.model';

export class GetGlobalMenuService {
  static async execute(data: any, _user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      const session = await Session.findOne({ session_id: sessionId });
      if (!session) {
        return {
          success: false,
          message: 'Session not found'
        };
      }

      const sessionData = session.data as any || {};

      const menu = [
        { name: '게임', url: '/game', newTab: false },
        { name: '연감', url: '/history', newTab: true },
        { name: '외교', url: '/diplomacy', newTab: true },
        { name: '통계', url: '/stats', newTab: true }
      ];

      return {
        success: true,
        result: true,
        menu,
        version: 1
      };
    } catch (error: any) {
      console.error('GetGlobalMenu error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

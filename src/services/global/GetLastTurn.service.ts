import { sessionRepository } from '../../repositories/session.repository';

export class GetLastTurnService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          success: false,
          message: 'Session not found'
        };
      }

      const sessionData = session.data as any || {};
      
      return {
        success: true,
        result: true,
        year: sessionData.year || 180,
        month: sessionData.month || 1,
        turntime: sessionData.turntime || null,
        lastExecuted: sessionData.lastExecuted || null
      };
    } catch (error: any) {
      console.error('GetLastTurn error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

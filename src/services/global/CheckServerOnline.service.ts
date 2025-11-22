import { sessionRepository } from '../../repositories/session.repository';

export class CheckServerOnlineService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      const session = await sessionRepository.findBySessionId(sessionId );
      
      if (!session) {
        return {
          success: false,
          result: false,
          online: false,
          message: '세션을 찾을 수 없습니다.'

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

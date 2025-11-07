import { sessionRepository } from '../../repositories/session.repository';
import { GetMapService } from './GetMap.service';

export class GetCachedMapService {
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

      return await GetMapService.execute(data, user);
    } catch (error: any) {
      console.error('GetCachedMap error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

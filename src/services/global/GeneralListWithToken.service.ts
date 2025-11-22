import { sessionRepository } from '../../repositories/session.repository';
import { GeneralListService } from './GeneralList.service';

export class GeneralListWithTokenService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          success: false,
          message: '세션을 찾을 수 없습니다.'
        };

      }

      return await GeneralListService.execute(data, user);
    } catch (error: any) {
      console.error('GeneralListWithToken error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

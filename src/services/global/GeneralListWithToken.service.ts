import { Session } from '../../models/session.model';
import { GeneralListService } from './GeneralList.service';

export class GeneralListWithTokenService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      const session = await (Session as any).findOne({ session_id: sessionId });
      if (!session) {
        return {
          success: false,
          message: 'Session not found'
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

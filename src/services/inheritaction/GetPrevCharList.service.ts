import { InheritActionRepository } from '../../repositories/inheritaction.repository';
import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';
import { KVStorage } from '../../models/kv-storage.model';

export class GetPrevCharListService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    
    try {
      const userStor = await KVStorage.findOne({ 
        session_id: sessionId, 
        key: `user_${userId}` 
      });
      
      const prevCharList = userStor?.value?.prev_char_list || [];
      
      const generals = await General.find({
        session_id: sessionId,
        no: { $in: prevCharList }
      })
      .select('no name nation leadership strength intel')
      .lean();
      
      return {
        success: true,
        result: generals,
        message: 'GetPrevCharList executed successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

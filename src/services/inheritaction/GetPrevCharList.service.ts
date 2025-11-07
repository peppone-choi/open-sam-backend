import { InheritActionRepository } from '../../repositories/inheritaction.repository';
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { KVStorage } from '../../models/kv-storage.model';
import { kvStorageRepository } from '../../repositories/kvstorage.repository';

export class GetPrevCharListService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    
    try {
      const userStor = await kvStorageRepository.findOneByFilter({ 
        session_id: sessionId, 
        key: `user_${userId}` 
      });
      
      const prevCharList = userStor?.value?.prev_char_list || [];
      
      const generals = await generalRepository.findByFilter({
        session_id: sessionId,
        no: { $in: prevCharList }
      })
      
      ;
      
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

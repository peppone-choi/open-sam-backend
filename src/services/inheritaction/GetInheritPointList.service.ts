import { InheritActionRepository } from '../../repositories/inheritaction.repository';
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { KVStorage } from '../../models/kv-storage.model';
import { kvStorageRepository } from '../../repositories/kvstorage.repository';

enum InheritanceKey {
  previous = 'previous',
  lived_month = 'lived_month',
  max_belong = 'max_belong',
  max_domestic_critical = 'max_domestic_critical',
  active_action = 'active_action',
  combat = 'combat',
  sabotage = 'sabotage',
  unifier = 'unifier',
  dex = 'dex',
  tournament = 'tournament',
  betting = 'betting',
}

export class GetInheritPointListService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    const generalId = user?.generalId || data.general_id;
    
    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId );
      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다.' };
      }
      
      const inheritStor = await kvStorageRepository.findOneByFilter({ 
        session_id: sessionId, 
        key: `inheritance_${userId}` 
      });
      
      const items: Record<string, number> = {};
      
      for (const key of Object.values(InheritanceKey)) {
        const value = inheritStor?.value?.[key];
        if (Array.isArray(value)) {
          items[key] = value[0] || 0;
        } else if (typeof value === 'number') {
          items[key] = value;
        } else {
          items[key] = 0;
        }
      }
      
      return {
        success: true,
        result: items,
        message: 'GetInheritPointList executed successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

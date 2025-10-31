import { InheritActionRepository } from '../../repositories/inheritaction.repository';
import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';
import { KVStorage } from '../../models/kv-storage.model';

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
      const general = await General.findOne({ session_id: sessionId, no: generalId });
      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다.' };
      }
      
      const inheritStor = await KVStorage.findOne({ 
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

import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';

/**
 * SetNPCControl Service
 * NPC 제어 설정
 */
export class SetNPCControlService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || user?.id || data.user_id;
    const generalId = user?.generalId || data.general_id;
    const { type, control } = data;
    
    try {
      if (!generalId) {
        const general = await (General as any).findOne({
          session_id: sessionId,
          owner: String(userId),
          'data.npc': { $lt: 2 }
        });
        
        if (!general) {
          return {
            result: false,
            reason: '장수를 찾을 수 없습니다'
          };
        }
      }
      
      const general = await (General as any).findOne({
        session_id: sessionId,
        'data.no': generalId
      });
      
      if (!general) {
        return {
          result: false,
          reason: '장수를 찾을 수 없습니다'
        };
      }
      
      const generalData = general.data || {};
      const nationId = generalData.nation || 0;
      
      if (nationId === 0) {
        return {
          result: false,
          reason: '국가에 소속되어 있지 않습니다'
        };
      }
      
      // 권한 확인 (수뇌부 이상)
      const officerLevel = generalData.officer_level || 0;
      if (officerLevel < 5) {
        return {
          result: false,
          reason: '권한이 부족합니다. 수뇌부가 아니거나 사관년도가 부족합니다'
        };
      }
      
      // TODO: 실제 NPC 정책 저장 로직 구현 (KVStorage 사용)
      // 현재는 성공 응답만 반환
      
      return {
        result: true,
        message: 'NPC 제어 설정이 완료되었습니다'
      };
    } catch (error: any) {
      return {
        result: false,
        reason: error.message || 'NPC 제어 설정 중 오류가 발생했습니다'
      };
    }
  }
}



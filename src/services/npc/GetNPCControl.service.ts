import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { sessionRepository } from '../../repositories/session.repository';

/**
 * GetNPCControl Service
 * NPC 제어 정보 조회
 */
export class GetNPCControlService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || user?.id || data.user_id;
    const generalId = user?.generalId || data.general_id;
    
    try {
      if (!generalId) {
        const general = await generalRepository.findBySessionAndOwner({
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
      
      const general = await generalRepository.findBySessionAndNo({
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
      
      const session = await sessionRepository.findBySessionId(sessionId );
      const sessionData = session?.data || {};
      const gameEnv = sessionData.game_env || {};
      
      // NPC 정책 정보 (기본값 반환)
      const control = {
        nationPolicy: {
          values: gameEnv.npc_nation_policy?.values || {},
          priority: gameEnv.npc_nation_policy?.priority || []
        },
        generalPolicy: {
          priority: gameEnv.npc_general_policy?.priority || []
        },
        defaultNationPolicy: {},
        defaultNationPriority: [],
        defaultGeneralActionPriority: []
      };
      
      return {
        result: true,
        control
      };
    } catch (error: any) {
      return {
        result: false,
        reason: error.message || 'NPC 제어 정보 조회 중 오류가 발생했습니다'
      };
    }
  }
}



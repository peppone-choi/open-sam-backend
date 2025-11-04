import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';

/**
 * GetChiefCenter Service
 * 제왕(군주)의 특수 기능 및 정보 조회
 */
export class GetChiefCenterService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || user?.id || data.user_id;
    const generalId = user?.generalId || data.general_id;
    
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
      const officerLevel = generalData.officer_level || 0;
      
      // 제왕 권한 확인 (officer_level >= 12 또는 chief)
      if (officerLevel < 12 && generalData.permission !== 'chief') {
        return {
          result: false,
          reason: '제왕 권한이 없습니다'
        };
      }
      
      if (nationId === 0) {
        return {
          result: false,
          reason: '국가에 소속되어 있지 않습니다'
        };
      }
      
      const nation = await (Nation as any).findOne({
        session_id: sessionId,
        'data.nation': nationId
      });
      
      if (!nation) {
        return {
          result: false,
          reason: '국가를 찾을 수 없습니다'
        };
      }
      
      const nationData = nation.data || {};
      
      // 제왕 센터 정보
      const center = {
        nation: {
          id: nationId,
          name: nationData.name || '무명',
          level: nationData.level || 0
        },
        chief: {
          generalId: generalId,
          name: generalData.name || '무명',
          officerLevel: officerLevel
        },
        powers: {
          gold: nationData.gold || 0,
          rice: nationData.rice || 0,
          tech: nationData.tech || 0
        },
        specialCommands: {
          // 제왕 전용 명령 목록
          available: []
        }
      };
      
      return {
        result: true,
        center
      };
    } catch (error: any) {
      return {
        result: false,
        reason: error.message || '제왕 센터 정보 조회 중 오류가 발생했습니다'
      };
    }
  }
}



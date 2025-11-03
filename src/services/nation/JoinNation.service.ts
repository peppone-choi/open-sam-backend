import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';

/**
 * JoinNation Service
 * 국가 가입 처리
 */
export class JoinNationService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const targetNationId = parseInt(data.nationId || data.nation_id);
    
    try {
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      if (!targetNationId) {
        return { success: false, message: '국가 ID가 필요합니다' };
      }

      const general = await (General as any).findOne({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const currentNationId = general.data?.nation || 0;

      if (currentNationId !== 0) {
        return { success: false, message: '이미 국가에 소속되어 있습니다' };
      }

      const nation = await (Nation as any).findOne({
        session_id: sessionId,
        'data.nation': targetNationId
      });

      if (!nation) {
        return { success: false, message: '국가를 찾을 수 없습니다' };
      }

      const scout = nation.data?.scout || 0;
      if (scout === 1) {
        return { success: false, message: '해당 국가는 현재 임관을 받지 않습니다' };
      }

      await (General as any).updateOne(
        {
          session_id: sessionId,
          'data.no': generalId
        },
        {
          $set: {
            'data.nation': targetNationId,
            'data.officer_level': 1,
            'data.belong': targetNationId,
            'data.permission': 'normal'
          }
        }
      );

      await (Nation as any).updateOne(
        {
          session_id: sessionId,
          'data.nation': targetNationId
        },
        {
          $inc: {
            'data.gennum': 1
          }
        }
      );

      return {
        success: true,
        result: true,
        message: `${nation.data?.name || '무명국'}에 가입하였습니다`
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

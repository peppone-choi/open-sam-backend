import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';

/**
 * WithdrawNation Service
 * 국가 탈퇴
 */
export class WithdrawNationService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    
    try {
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      const general = await General.findOne({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const officerLevel = general.data?.officer_level || 0;
      const nationId = general.data?.nation || 0;

      if (nationId === 0) {
        return { success: false, message: '국가에 소속되어 있지 않습니다' };
      }

      if (officerLevel === 12) {
        return { success: false, message: '군주는 탈퇴할 수 없습니다. 먼저 선양하세요' };
      }

      await General.updateOne(
        {
          session_id: sessionId,
          'data.no': generalId
        },
        {
          $set: {
            'data.nation': 0,
            'data.officer_level': 1,
            'data.belong': 0,
            'data.permission': 'normal',
            'data.troop': 0
          }
        }
      );

      await Nation.updateOne(
        {
          session_id: sessionId,
          'data.nation': nationId
        },
        {
          $inc: {
            'data.gennum': -1
          }
        }
      );

      return {
        success: true,
        result: true,
        message: '국가에서 탈퇴하였습니다'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

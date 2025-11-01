import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';
import { Session } from '../../models/session.model';

/**
 * SetBlockScout Service
 * 임관 차단 설정
 * PHP: /sam/hwe/sammo/API/Nation/SetBlockScout.php
 */
export class SetBlockScoutService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const value = data.value === true || data.value === 'true' || data.value === 1;
    
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
      const permission = general.data?.permission || 'normal';
      const nationId = general.data?.nation || 0;

      if (officerLevel < 5 && permission !== 'ambassador') {
        return { success: false, message: '권한이 부족합니다' };
      }

      if (nationId === 0) {
        return { success: false, message: '국가에 소속되어 있어야 합니다' };
      }

      const session = await Session.findOne({ session_id: sessionId });
      const blockChangeScout = session?.data?.block_change_scout || false;

      if (blockChangeScout) {
        return { success: false, message: '임관 설정을 바꿀 수 없도록 설정되어 있습니다' };
      }

      await Nation.updateOne(
        {
          session_id: sessionId,
          'data.nation': nationId
        },
        {
          $set: {
            'data.scout': value ? 1 : 0
          }
        }
      );

      return {
        success: true,
        result: true,
        message: value ? '임관이 차단되었습니다' : '임관이 허용되었습니다'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

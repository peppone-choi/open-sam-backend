import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';

/**
 * SetRate Service
 * 세율 설정
 * PHP: /sam/hwe/sammo/API/Nation/SetRate.php
 */
export class SetRateService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const amount = parseInt(data.amount);
    
    try {
      if (!amount || amount < 5 || amount > 30) {
        return { success: false, message: '세율은 5~30 사이여야 합니다' };
      }

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

      await Nation.updateOne(
        {
          session_id: sessionId,
          'data.nation': nationId
        },
        {
          $set: {
            'data.rate': amount
          }
        }
      );

      return {
        success: true,
        result: true,
        message: `세율이 ${amount}%로 설정되었습니다`
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

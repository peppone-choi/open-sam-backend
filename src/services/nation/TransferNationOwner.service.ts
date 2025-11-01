import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';

/**
 * TransferNationOwner Service
 * 군주 선양 (국가 소유권 이전)
 */
export class TransferNationOwnerService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const targetGeneralId = parseInt(data.targetGeneralId || data.target_general_id);
    
    try {
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      if (!targetGeneralId) {
        return { success: false, message: '대상 장수 ID가 필요합니다' };
      }

      const general = await General.findOne({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const targetGeneral = await General.findOne({
        session_id: sessionId,
        'data.no': targetGeneralId
      });

      if (!targetGeneral) {
        return { success: false, message: '대상 장수를 찾을 수 없습니다' };
      }

      const officerLevel = general.data?.officer_level || 0;
      const nationId = general.data?.nation || 0;
      const targetNationId = targetGeneral.data?.nation || 0;
      const targetNpc = targetGeneral.data?.npc || 0;

      if (officerLevel !== 12) {
        return { success: false, message: '권한이 부족합니다. 군주만 선양할 수 있습니다' };
      }

      if (nationId === 0) {
        return { success: false, message: '국가에 소속되어 있지 않습니다' };
      }

      if (nationId !== targetNationId) {
        return { success: false, message: '같은 국가의 장수가 아닙니다' };
      }

      if (targetNpc >= 2) {
        return { success: false, message: 'NPC에게는 선양할 수 없습니다' };
      }

      if (generalId === targetGeneralId) {
        return { success: false, message: '자기 자신에게는 선양할 수 없습니다' };
      }

      await General.updateOne(
        {
          session_id: sessionId,
          'data.no': generalId
        },
        {
          $set: {
            'data.officer_level': 11
          }
        }
      );

      await General.updateOne(
        {
          session_id: sessionId,
          'data.no': targetGeneralId
        },
        {
          $set: {
            'data.officer_level': 12
          }
        }
      );

      return {
        success: true,
        result: true,
        message: `${targetGeneral.data?.name || '무명'}에게 군주를 선양하였습니다`
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

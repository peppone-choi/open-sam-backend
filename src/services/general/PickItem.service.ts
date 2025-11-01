import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';
import { GeneralRecord } from '../../models/general_record.model';

/**
 * PickItem Service (아이템 줍기)
 * 도시나 전투에서 떨어진 아이템을 주워서 장착
 */
export class PickItemService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const itemType = data.itemType;
    const itemCode = data.itemCode;
    
    if (!generalId) {
      return {
        success: false,
        message: '장수 정보가 없습니다'
      };
    }

    if (!itemType || !itemCode) {
      return {
        success: false,
        message: '아이템 정보가 필요합니다'
      };
    }

    try {
      const general = await General.findOne({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return {
          success: false,
          message: '장수를 찾을 수 없습니다'
        };
      }

      const currentItem = general.data?.[itemType];
      if (currentItem && currentItem !== 'None') {
        return {
          success: false,
          message: '이미 아이템을 장착하고 있습니다. 먼저 버려주세요.'
        };
      }

      general.data = general.data || {};
      general.data[itemType] = itemCode;
      general.markModified('data');
      await general.save();

      const session = await Session.findOne({ session_id: sessionId });
      const gameEnv = session?.data || {};

      await GeneralRecord.create({
        session_id: sessionId,
        general_id: generalId,
        year: gameEnv.year || 184,
        month: gameEnv.month || 1,
        type: 'action',
        text: `${itemCode}을(를) 주웠습니다.`,
        date: new Date()
      });

      return {
        success: true,
        result: true,
        message: '아이템을 주웠습니다'
      };
    } catch (error: any) {
      console.error('PickItem error:', error);
      return {
        success: false,
        message: error.message || '아이템 줍기 중 오류가 발생했습니다'
      };
    }
  }
}

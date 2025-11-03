import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';
import { GeneralRecord } from '../../models/general_record.model';

/**
 * SetItems Service (아이템 일괄 설정)
 * 여러 아이템을 한 번에 설정
 */
export class SetItemsService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const items = data.items;
    
    if (!generalId) {
      return {
        success: false,
        message: '장수 정보가 없습니다'
      };
    }

    if (!items || typeof items !== 'object') {
      return {
        success: false,
        message: '아이템 정보가 필요합니다'
      };
    }

    try {
      const general = await (General as any).findOne({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return {
          success: false,
          message: '장수를 찾을 수 없습니다'
        };
      }

      general.data = general.data || {};

      const validItemSlots = ['item0', 'item1', 'item2', 'item3', 'item4'];
      const updatedSlots: string[] = [];

      for (const [slot, itemCode] of Object.entries(items)) {
        if (validItemSlots.includes(slot)) {
          general.data[slot] = itemCode || 'None';
          updatedSlots.push(slot);
        }
      }

      if (updatedSlots.length === 0) {
        return {
          success: false,
          message: '유효한 아이템 슬롯이 없습니다'
        };
      }

      general.markModified('data');
      await general.save();

      const session = await (Session as any).findOne({ session_id: sessionId });
      const gameEnv = session?.data || {};

      const { getNextRecordId } = await import('../../utils/record-helpers');
      const recordId = await getNextRecordId(sessionId);
      await (GeneralRecord as any).create({
        session_id: sessionId,
        data: {
          id: recordId,
          general_id: generalId,
          year: gameEnv.year || 184,
          month: gameEnv.month || 1,
          log_type: 'action',
          text: `아이템을 ${updatedSlots.length}개 설정하였습니다.`,
          date: new Date().toISOString()
        }
      });

      return {
        success: true,
        result: true,
        message: '아이템이 설정되었습니다',
        updatedSlots
      };
    } catch (error: any) {
      console.error('SetItems error:', error);
      return {
        success: false,
        message: error.message || '아이템 설정 중 오류가 발생했습니다'
      };
    }
  }
}

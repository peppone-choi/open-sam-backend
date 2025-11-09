import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { generalRecordRepository } from '../../repositories/general-record.repository';

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
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);

      if (!general) {
        return {
          success: false,
          message: '장수를 찾을 수 없습니다'
        };
      }

      const currentItem = general[itemType];
      if (currentItem && currentItem !== 'None') {
        return {
          success: false,
          message: '이미 아이템을 장착하고 있습니다. 먼저 버려주세요.'
        };
      }

      await generalRepository.updateBySessionAndNo(sessionId, generalId, {
        [itemType]: itemCode
      });

      const session = await sessionRepository.findBySessionId(sessionId);
      const gameEnv = session?.data || {};

      const { getNextRecordId } = await import('../../utils/record-helpers');
      const recordId = await getNextRecordId(sessionId);
      await generalRecordRepository.create({
        session_id: sessionId,
        data: {
          id: recordId,
          general_id: generalId,
          year: gameEnv.year || 184,
          month: gameEnv.month || 1,
          log_type: 'action',
          text: `${itemCode}을(를) 주웠습니다.`,
          date: new Date().toISOString()
        }
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

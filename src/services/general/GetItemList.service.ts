import { generalRepository } from '../../repositories/general.repository';
import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';

/**
 * GetItemList Service
 * 장수의 아이템 목록 조회
 */
export class GetItemListService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    
    if (!generalId) {
      return {
        success: false,
        message: '장수 ID가 필요합니다'
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

      // 아이템 정보 추출
      const items = {
        weapon: general.data?.item0 || null,
        armor: general.data?.item1 || null,
        horse: general.data?.item2 || null,
        book: general.data?.item3 || null,
        special: general.data?.item4 || null,
      };

      return {
        success: true,
        result: true,
        items
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

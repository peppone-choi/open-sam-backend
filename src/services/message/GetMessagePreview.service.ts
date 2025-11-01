import { General } from '../../models/general.model';
import { Message } from '../../models/message.model';

/**
 * GetMessagePreview Service
 * 메시지 미리보기 (읽지 않은 메시지 개수)
 */
export class GetMessagePreviewService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    
    try {
      if (!generalId) {
        return {
          success: true,
          result: true,
          unreadPrivate: 0,
          unreadDiplomacy: 0
        };
      }

      const general = await General.findOne({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const nationId = general.data?.nation || 0;
      const latestReadPrivate = general.data?.latest_read_private_msg || 0;
      const latestReadDiplomacy = general.data?.latest_read_diplomacy_msg || 0;

      const unreadPrivateCount = await Message.countDocuments({
        session_id: sessionId,
        'data.type': 'private',
        'data.id': { $gt: latestReadPrivate },
        $or: [
          { 'data.src_general_id': generalId },
          { 'data.dest_general_id': generalId }
        ]
      });

      const unreadDiplomacyCount = await Message.countDocuments({
        session_id: sessionId,
        'data.type': 'diplomacy',
        'data.dest_nation_id': nationId,
        'data.id': { $gt: latestReadDiplomacy }
      });

      return {
        success: true,
        result: true,
        unreadPrivate: unreadPrivateCount,
        unreadDiplomacy: unreadDiplomacyCount
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

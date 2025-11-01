import { MessageRepository } from '../../repositories/message.repository';
import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';

/**
 * ReadLatestMessage Service
 * 최근 메시지 읽음 표시
 * PHP: /sam/hwe/sammo/API/Message/ReadLatestMessage.php
 */
export class ReadLatestMessageService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const type = data.type; // 'private' or 'diplomacy'
    const msgID = parseInt(data.msgID);
    
    try {
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      if (!type || !msgID) {
        return { success: false, message: 'type과 msgID가 필요합니다' };
      }

      if (type !== 'private' && type !== 'diplomacy') {
        return { success: false, message: '잘못된 메시지 타입입니다' };
      }

      // 장수 정보 업데이트
      const fieldName = type === 'private' 
        ? 'data.latest_read_private_msg' 
        : 'data.latest_read_diplomacy_msg';

      await General.updateOne(
        {
          session_id: sessionId,
          'data.no': generalId
        },
        {
          $max: { [fieldName]: msgID }
        }
      );

      return {
        success: true,
        result: true
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

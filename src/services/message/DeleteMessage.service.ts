import { MessageRepository } from '../../repositories/message.repository';
import { generalRepository } from '../../repositories/general.repository';
import { messageRepository } from '../../repositories/message.repository';
import { Session } from '../../models/session.model';

/**
 * DeleteMessage Service
 * 메시지 삭제
 * PHP: /sam/hwe/sammo/API/Message/DeleteMessage.php
 */
export class DeleteMessageService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const msgID = parseInt(data.msgID);
    
    try {
      if (!msgID) {
        return { success: false, message: '메시지 ID가 필요합니다' };
      }

      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      // 메시지 조회
      const message = await messageRepository.findOneByFilter({
        session_id: sessionId,
        'data.id': msgID
      });

      if (!message) {
        return { success: false, message: '메시지를 찾을 수 없습니다' };
      }

      // 메시지 삭제 권한 확인 (발신자 또는 수신자만 삭제 가능)
      const srcGeneralId = message.data?.src_general_id;
      const destGeneralId = message.data?.dest_general_id;

      if (srcGeneralId !== generalId && destGeneralId !== generalId) {
        return { success: false, message: '메시지를 삭제할 권한이 없습니다' };
      }

      // 메시지 삭제
      await messageRepository.deleteByFilter({
        session_id: sessionId,
        'data.id': msgID
      });

      return {
        success: true,
        result: true,
        message: '메시지가 삭제되었습니다'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

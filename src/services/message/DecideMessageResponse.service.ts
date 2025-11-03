import { General } from '../../models/general.model';
import { Message } from '../../models/message.model';

/**
 * DecideMessageResponse Service
 * 외교 메시지 응답 (동의/거절)
 * PHP: /sam/hwe/sammo/API/Message/DecideMessageResponse.php
 */
export class DecideMessageResponseService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const msgID = parseInt(data.msgID);
    const response = data.response === true || data.response === 'true';
    
    try {
      if (!msgID || isNaN(msgID)) {
        return { success: false, message: '메시지 ID가 필요합니다' };
      }

      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      const message = await (Message as any).findOne({
        session_id: sessionId,
        'data.id': msgID
      });

      if (!message) {
        return { success: false, message: '존재하지 않는 메시지입니다' };
      }

      if (message.data?.type !== 'diplomacy') {
        return { success: false, message: '외교 메시지가 아닙니다' };
      }

      const general = await (General as any).findOne({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const nationId = general.data?.nation || 0;
      const destNationId = message.data?.dest_nation_id;

      if (destNationId !== nationId) {
        return { success: false, message: '메시지를 처리할 권한이 없습니다' };
      }

      const permission = general.data?.permission;
      if (permission !== 'strategic') {
        return { success: false, message: '외교권이 없습니다' };
      }

      if (message.data?.response) {
        return { success: false, message: '이미 응답한 메시지입니다' };
      }

      await (Message as any).updateOne(
        {
          session_id: sessionId,
          'data.id': msgID
        },
        {
          $set: {
            'data.response': response ? 'agree' : 'decline',
            'data.response_date': new Date(),
            'data.response_general_id': generalId,
            'data.response_general_name': general.data?.name || '무명'
          }
        }
      );

      return {
        success: true,
        result: true,
        reason: 'success'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

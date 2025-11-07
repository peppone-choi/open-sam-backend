import { generalRepository } from '../../repositories/general.repository';

/**
 * SetRecentMessageType Service
 * 최근 메시지 타입 설정 (사용자 선호도 저장)
 */
export class SetRecentMessageTypeService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const messageType = data.messageType;
    
    try {
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      if (!messageType) {
        return { success: false, message: 'messageType이 필요합니다' };
      }

      const validTypes = ['private', 'public', 'national', 'diplomacy'];
      if (!validTypes.includes(messageType)) {
        return { success: false, message: '잘못된 메시지 타입입니다' };
      }

      await generalRepository.updateOneByFilter(
        {
          session_id: sessionId,
          'data.no': generalId
        },
        {
          $set: {
            'data.recent_message_type': messageType
          }
        }
      );

      return {
        success: true,
        result: true,
        messageType: messageType
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

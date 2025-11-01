import { General } from '../../models/general.model';
import { Message } from '../../models/message.model';

/**
 * GetMessages Service
 * 특정 타입의 메시지 목록 조회
 */
export class GetMessagesService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const type = data.type;
    const limit = parseInt(data.limit) || 15;
    const offset = parseInt(data.offset) || 0;
    
    try {
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      if (!type) {
        return { success: false, message: 'type이 필요합니다' };
      }

      const validTypes = ['private', 'public', 'national', 'diplomacy'];
      if (!validTypes.includes(type)) {
        return { success: false, message: '잘못된 메시지 타입입니다' };
      }

      const general = await General.findOne({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const nationId = general.data?.nation || 0;

      let query: any = {
        session_id: sessionId
      };

      if (type === 'private') {
        query['data.type'] = 'private';
        query.$or = [
          { 'data.src_general_id': generalId },
          { 'data.dest_general_id': generalId }
        ];
      } else if (type === 'public') {
        query['data.type'] = 'public';
      } else if (type === 'national') {
        query['data.type'] = 'national';
        query['data.dest_nation_id'] = nationId;
      } else if (type === 'diplomacy') {
        query['data.type'] = 'diplomacy';
        query['data.dest_nation_id'] = nationId;
      }

      const messages = await Message.find(query)
        .sort({ 'data.id': -1 })
        .skip(offset)
        .limit(limit)
        .lean();

      const messageList = messages.map(msg => ({
        id: msg.data?.id,
        type: msg.data?.type,
        src_general_id: msg.data?.src_general_id,
        src_general_name: msg.data?.src_general_name,
        src_nation_id: msg.data?.src_nation_id,
        src_nation_name: msg.data?.src_nation_name,
        dest_general_id: msg.data?.dest_general_id,
        dest_general_name: msg.data?.dest_general_name,
        dest_nation_id: msg.data?.dest_nation_id,
        dest_nation_name: msg.data?.dest_nation_name,
        text: msg.data?.text,
        date: msg.data?.date
      }));

      return {
        success: true,
        result: true,
        messages: messageList,
        total: messageList.length
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

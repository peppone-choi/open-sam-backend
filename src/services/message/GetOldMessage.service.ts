// @ts-nocheck - Argument count mismatches need review
import { MessageRepository } from '../../repositories/message.repository';
import { generalRepository } from '../../repositories/general.repository';
import { messageRepository } from '../../repositories/message.repository';
import { Session } from '../../models/session.model';

/**
 * GetOldMessage Service
 * 이전 메시지 조회 (페이지네이션)
 * PHP: /sam/hwe/sammo/API/Message/GetOldMessage.php
 */
export class GetOldMessageService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const to = parseInt(data.to); // 어느 ID까지 가져올지
    const type = data.type; // 'private', 'public', 'national', 'diplomacy'
    
    try {
      if (!to || !type) {
        return { success: false, message: 'to와 type이 필요합니다' };
      }

      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      const validTypes = ['private', 'public', 'national', 'diplomacy'];
      if (!validTypes.includes(type)) {
        return { success: false, message: '잘못된 메시지 타입입니다' };
      }

      // 장수 정보 조회
      const general = await generalRepository.findBySessionAndNo({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const nationId = general.nation || 0;
      const generalName = general.name || '무명';

      // 메시지 조회
      let query: any = {
        session_id: sessionId,
        'data.id': { $lt: to }
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

      const messages = await messageRepository.findByFilter(query);
      
      // 정렬 및 limit 처리
      const sortedMessages = messages.sort((a: any, b: any) => {
        const aId = a.data?.id || 0;
        const bId = b.data?.id || 0;
        return bId - aId; // 내림차순
      });
      
      const limitedMessages = sortedMessages.slice(0, 15);

      const messageList = limitedMessages.map((msg: any) => ({
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

      const result: any = {
        private: [],
        public: [],
        national: [],
        diplomacy: [],
        result: true,
        keepRecent: true,
        sequence: 0,
        nationID: nationId,
        generalName: generalName
      };

      result[type] = messageList;

      return {
        success: true,
        ...result
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

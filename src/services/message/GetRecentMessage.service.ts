// @ts-nocheck - Argument count mismatches need review
import { MessageRepository } from '../../repositories/message.repository';
import { generalRepository } from '../../repositories/general.repository';
import { messageRepository } from '../../repositories/message.repository';
import { Session } from '../../models/session.model';

/**
 * GetRecentMessage Service
 * 최근 메시지 조회
 * PHP: /sam/hwe/sammo/API/Message/GetRecentMessage.php
 */
export class GetRecentMessageService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const sequence = parseInt(data.sequence) || -1;
    
    try {
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      // 장수 정보 조회
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const nationId = general.nation || 0;
      const generalName = general.name || '무명';
      const permission = general.permission || '';

      let nextSequence = sequence;
      let minSequence = sequence;
      let lastType: string | null = null;

      // 개인 메시지
      const privateQuery: any = {
        session_id: sessionId,
        'data.type': 'private',
        'data.id': { $gt: sequence },
        $or: [
          { 'data.src_general_id': generalId },
          { 'data.dest_general_id': generalId }
        ]
      };
      let privateMessages = await messageRepository.findByFilter(privateQuery);
      privateMessages = privateMessages.sort((a: any, b: any) => (b.data?.id || 0) - (a.data?.id || 0)).slice(0, 15);

      // 공개 메시지
      const publicQuery: any = {
        session_id: sessionId,
        'data.type': 'public',
        'data.id': { $gt: sequence }
      };
      let publicMessages = await messageRepository.findByFilter(publicQuery);
      publicMessages = publicMessages.sort((a: any, b: any) => (b.data?.id || 0) - (a.data?.id || 0)).slice(0, 15);

      // 국가 메시지
      const nationalQuery: any = {
        session_id: sessionId,
        'data.type': 'national',
        'data.dest_nation_id': nationId,
        'data.id': { $gt: sequence }
      };
      let nationalMessages = await messageRepository.findByFilter(nationalQuery);
      nationalMessages = nationalMessages.sort((a: any, b: any) => (b.data?.id || 0) - (a.data?.id || 0)).slice(0, 15);

      // 외교 메시지
      const diplomacyQuery: any = {
        session_id: sessionId,
        'data.type': 'diplomacy',
        'data.dest_nation_id': nationId,
        'data.id': { $gt: sequence }
      };
      let diplomacyMessages = await messageRepository.findByFilter(diplomacyQuery);
      diplomacyMessages = diplomacyMessages.sort((a: any, b: any) => (b.data?.id || 0) - (a.data?.id || 0)).slice(0, 15);

      const mapMessages = (msgs: any[], msgType: string) => {
        return msgs.map(msg => {
          const id = msg.data?.id || 0;
          if (id > nextSequence) nextSequence = id;
          if (id <= minSequence) {
            minSequence = id;
            lastType = msgType;
          }

          return {
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
          };
        });
      };

      const result: any = {
        result: true,
        private: mapMessages(privateMessages, 'private'),
        public: mapMessages(publicMessages, 'public'),
        national: mapMessages(nationalMessages, 'national'),
        diplomacy: mapMessages(diplomacyMessages, 'diplomacy'),
        sequence: nextSequence,
        nationID: nationId,
        generalName: generalName,
        latestRead: {
          diplomacy: general.latest_read_diplomacy_msg || 0,
          private: general.latest_read_private_msg || 0
        }
      };

      // 마지막 타입의 메시지 제거
      if (lastType) {
        result[lastType].pop();
      }

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

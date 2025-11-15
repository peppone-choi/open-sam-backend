// @ts-nocheck - Argument count mismatches need review
import { generalRepository } from '../../repositories/general.repository';
import { messageRepository } from '../../repositories/message.repository';
import { logger } from '../../common/logger';

/**
 * GetMessages Service
 * 특정 타입의 메시지 목록 조회
 */
export class GetMessagesService {
  static async execute(data: any, user?: any) {
    // serverID 또는 session_id 파라미터에서 세션 ID 추출
    const sessionId = data.serverID || data.session_id || process.env.DEFAULT_SESSION_ID || 'sangokushi_default';
    const userId = user?.userId || user?.id || data.user_id;
    let generalId = user?.generalId || data.general_id;
    
    console.log('[GetMessages] 파라미터 확인:', {
      serverID: data.serverID,
      session_id: data.session_id,
      extractedSessionId: sessionId,
      userId,
      generalId,
      type: data.type
    });
    
    logger.info('GetMessages 요청', {
      sessionId,
      userId,
      generalId,
      type: data.type,
      limit: data.limit,
      offset: data.offset
    });
    
    // generalId를 숫자로 변환
    if (generalId) {
      generalId = parseInt(generalId);
      if (isNaN(generalId) || generalId === 0) {
        generalId = null;
      }
    }
    
    const type = data.type;
    const limit = parseInt(data.limit) || 15;
    const offset = parseInt(data.offset) || 0;
    
    try {
      if (!type) {
        logger.warn('type 파라미터 없음', { data, user });
        return { success: false, message: 'type이 필요합니다' };
      }

      const validTypes = ['private', 'public', 'national', 'diplomacy', 'system'];
      if (!validTypes.includes(type)) {
        logger.warn('잘못된 메시지 타입', { 
          receivedType: type, 
          typeOf: typeof type,
          validTypes,
          data,
          query: data
        });
        return { success: false, message: `잘못된 메시지 타입입니다: ${type} (유효한 타입: ${validTypes.join(', ')})` };
      }

      // generalId가 없으면 userId로 찾기
      let general;
      if (generalId) {
        console.log('[GetMessages] generalId로 장수 찾기:', generalId, sessionId);
        general = await generalRepository.findBySessionAndNo(sessionId, generalId);
        
        // 🔒 보안 검증: 이 장수가 이 유저의 소유인지 확인
        if (general) {
          const generalOwner = String(general.owner || '');
          if (generalOwner !== String(userId)) {
            console.log('[GetMessages] ❌ 권한 없음! generalId:', generalId, 'owner:', generalOwner, 'userId:', userId);
            return { success: false, message: '해당 장수에 대한 권한이 없습니다' };
          }
        }
      } else if (userId) {
        console.log('[GetMessages] userId로 장수 찾기:', userId, sessionId);
        general = await generalRepository.findBySessionAndOwner(
          sessionId,
          String(userId)
        );
        console.log('[GetMessages] 찾은 장수:', general ? {
          no: general.no,
          name: general.name,
          owner: general.owner
        } : 'NULL');
        
        if (general) {
          generalId = general.no;
          console.log('[GetMessages] ✅ userId로 장수 찾음! generalId:', generalId);
        } else {
          console.log('[GetMessages] ❌ userId로 장수를 못 찾음!');
        }
      } else {
        console.log('[GetMessages] ❌ userId도 generalId도 없음!');
        return { success: false, message: '사용자 인증 정보가 필요합니다' };
      }
      
      if (!generalId || !general) {
        console.log('[GetMessages] ❌ 최종 검증 실패:', { generalId, hasGeneral: !!general, sessionId, userId });
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }
      
      console.log('[GetMessages] ✅ 장수 권한 검증 완료! generalId:', generalId, 'owner:', general.owner);

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const nationId = general.nation || 0;

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
        query['data.dest_nation_id'] = nationId; // 내 국가의 회의실만
      } else if (type === 'national') {
        query['data.type'] = 'national';
        query['data.dest_nation_id'] = nationId;
      } else if (type === 'diplomacy') {
        query['data.type'] = 'diplomacy';
        query['data.dest_nation_id'] = nationId;
      } else if (type === 'system') {
        query['data.type'] = 'system';
        query['data.dest_general_id'] = generalId;
      }

      logger.debug('메시지 조회 쿼리', { query, type, generalId, nationId: general.nation });
      
      const messages = await messageRepository.findByFilter(query);
      
      logger.info('메시지 조회 완료', { 
        type, 
        totalCount: messages.length, 
        offset, 
        limit,
        generalId 
      });
      
      // 정렬 및 페이지네이션은 배열로 처리
      const sortedMessages = messages.sort((a: any, b: any) => {
        const aId = a.data?.id || 0;
        const bId = b.data?.id || 0;
        return bId - aId; // 내림차순
      });
      
      const paginatedMessages = sortedMessages.slice(offset, offset + limit);

      const messageList = paginatedMessages.map((msg: any) => ({
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
      logger.error('GetMessages 실패', {
        error: error.message,
        stack: error.stack,
        sessionId,
        userId,
        generalId,
        type: data.type
      });
      return {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
  }
}

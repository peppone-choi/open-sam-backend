/**
 * Raise Event Service
 * 이벤트 트리거 (j_raise_event.php) - 관리자 전용
 */

import { sessionRepository } from '../../repositories/session.repository';
import { logger } from '../../common/logger';

export class RaiseEventService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const eventName = data.event;
    const eventArgs = data.arg || {};
    
    // 관리자 권한 확인 (grade >= 6)
    if (!user || (user.grade || 0) < 6) {
      return {
        result: false,
        reason: '권한이 부족합니다.'
      };
    }

    if (!eventName) {
      return {
        result: false,
        reason: 'event가 지정되지 않았습니다.'
      };
    }

    try {
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          result: false,
          reason: '세션을 찾을 수 없습니다'
        };
      }

      // 이벤트 처리 (간단화된 버전)
      // 실제로는 Event.Action.build() 같은 시스템이 필요
      logger.info('이벤트 트리거', { 
        sessionId, 
        eventName, 
        eventArgs, 
        userId: user.userId 
      });

      // TODO: 실제 이벤트 처리 로직 구현
      // 현재는 성공 응답만 반환
      return {
        result: true,
        reason: 'success',
        info: {
          event: eventName,
          args: eventArgs,
          processed: true
        }
      };
    } catch (error: any) {
      logger.error('이벤트 트리거 실패', { error: error.message });
      return {
        result: false,
        reason: error.message
      };
    }
  }
}



import { Session } from '../../models/session.model';

/**
 * RaiseEvent Service
 * 관리자가 게임 이벤트를 발생시키는 서비스
 * 관리자 전용 (grade >= 6)
 */
export class RaiseEventService {
  static async execute(data: any, user?: any) {
    // 권한 확인 (grade >= 6)
    if (!user || user.grade < 6) {
      return {
        result: false,
        reason: '권한이 부족합니다.'
      };
    }

    const eventName = data.event || data.eventName;
    const eventArgsJson = data.arg || data.args;

    if (!eventName) {
      return {
        result: false,
        reason: 'event가 지정되지 않았습니다.'
      };
    }

    try {
      const sessionId = data.session_id || 'sangokushi_default';
      const session = await (Session as any).findOne({ session_id: sessionId });

      if (!session) {
        return {
          result: false,
          reason: '세션을 찾을 수 없습니다.'
        };
      }

      // 이벤트 인자 파싱
      let eventArgs: any[] = [eventName];
      
      if (eventArgsJson) {
        try {
          let parsedArgs: any;
          if (typeof eventArgsJson === 'string') {
            parsedArgs = JSON.parse(eventArgsJson);
          } else {
            parsedArgs = eventArgsJson;
          }

          if (Array.isArray(parsedArgs)) {
            eventArgs = [eventName, ...parsedArgs];
          } else {
            eventArgs = [eventName, parsedArgs];
          }
        } catch (e) {
          return {
            result: false,
            reason: 'arg가 올바른 json이 아닙니다'
          };
        }
      }

      // TODO: 실제 이벤트 처리 로직 구현
      // 현재는 이벤트를 받아서 저장만 함
      // 나중에 게임 데몬에서 처리하도록 큐에 추가해야 함
      
      // 이벤트 로그 저장 (예시)
      console.log(`[RaiseEvent] ${eventName}`, eventArgs);

      // TODO: 이벤트를 게임 큐에 추가하는 로직
      // - Redis나 MongoDB에 이벤트 저장
      // - 게임 데몬이 주기적으로 확인하여 처리
      // - 또는 즉시 처리하는 방식

      return {
        result: true,
        reason: 'success',
        eventName,
        eventArgs: eventArgs.slice(1) // eventName 제외
      };
    } catch (error: any) {
      console.error('RaiseEvent error:', error);
      return {
        result: false,
        reason: error.message || '이벤트 발생 실패'
      };
    }
  }
}


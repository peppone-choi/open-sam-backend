import { Session } from '../../models/session.model';

/**
 * GetServerBasicInfo Service
 * 서버 기본 정보 조회
 * PHP: j_server_basic_info.php
 */
export class GetServerBasicInfoService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';

    try {
      const session = await (Session as any).findOne({ session_id: sessionId }).lean();

      if (!session) {
        return {
          result: false,
          reason: '세션을 찾을 수 없습니다'
        };
      }

      // 세션 설정에서 기본 정보 추출
      const sessionData = session.config || {};
      
      return {
        result: true,
        server_id: sessionId,
        server_name: session.name || sessionId,
        server_nick: sessionId,
        map_name: sessionData.map_name || 'default',
        unit_set: sessionData.unit_set || 'default',
        max_turn: sessionData.max_turn || 30,
        max_push_turn: sessionData.max_push_turn || 12,
        turn_term: sessionData.turn_term || 10,
        status: session.status || 'unknown',
        year: sessionData.current_year || 184,
        month: sessionData.current_month || 1
      };
    } catch (error: any) {
      console.error('GetServerBasicInfo error:', error);
      return {
        result: false,
        reason: error.message || '서버 정보 조회 실패'
      };
    }
  }
}







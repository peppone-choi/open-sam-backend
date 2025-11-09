// @ts-nocheck - Argument count mismatches need review
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';

/**
 * Vacation Service
 * 휴가 모드 설정 (PHP: j_vacation.php)
 * 장수의 killturn을 3배로 늘려서 턴 처리를 미루는 기능
 */
export class VacationService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    const generalId = user?.generalId || data.general_id;
    
    try {
      if (!userId || !generalId) {
        return {
          result: false,
          reason: '로그인이 필요합니다'
        };
      }

      // 세션 확인
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          result: false,
          reason: '세션을 찾을 수 없습니다'
        };
      }

      const sessionData = session.data || {};
      const autorunUser = sessionData.autorun_user || {};

      // 자동 턴 모드인 경우 휴가 불가
      if (autorunUser.limit_minutes) {
        return {
          result: false,
          reason: '자동 턴인 경우에는 휴가 명령이 불가능합니다.'
        };
      }

      // 장수 조회
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);

      if (!general) {
        return {
          result: false,
          reason: '장수를 찾을 수 없습니다'
        };
      }

      // 소유권 확인
      if (String(general.owner) !== String(userId)) {
        return {
          result: false,
          reason: '권한이 없습니다'
        };
      }

      const killturn = sessionData.killturn || 1;

      // killturn을 3배로 증가 (휴가 모드)
      await generalRepository.updateBySessionAndNo(
        sessionId,
        generalId,
        { killturn: killturn * 3 }
      );

      return {
        result: true,
        reason: 'success'
      };
    } catch (error: any) {
      console.error('Vacation error:', error);
      return {
        result: false,
        reason: error.message || '휴가 모드 설정 실패'
      };
    }
  }
}


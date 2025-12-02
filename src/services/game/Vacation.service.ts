/**
 * Vacation Service
 * 휴가 모드 설정 (j_vacation.php)
 * 
 * CQRS 패턴: 캐시에 쓰기 → 데몬이 DB 동기화
 */

import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { logger } from '../../common/logger';
import { saveGeneral } from '../../common/cache/model-cache.helper';

export class VacationService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || user?.id;
    
    if (!userId) {
      return {
        result: false,
        reason: '인증이 필요합니다'
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

      const sessionData = session.data || {};
      const gameEnv = sessionData.game_env || {};
      const autorunUser = gameEnv.autorun_user || {};

      // 자동 턴인 경우 휴가 불가
      if (autorunUser.limit_minutes) {
        return {
          result: false,
          reason: '자동 턴인 경우에는 휴가 명령이 불가능합니다.'
        };
      }

      const general = await generalRepository.findBySessionAndOwner(sessionId, String(userId));

      if (!general) {
        return {
          result: false,
          reason: '장수를 찾을 수 없습니다'
        };
      }

      // killturn 설정 (기본 킬턴 * 3)
      const defaultKillturn = gameEnv.killturn || 30;
      const vacationKillturn = defaultKillturn * 3;

      const genData = general.data || general;
      genData.killturn = vacationKillturn;

      // CQRS 패턴: 캐시에 쓰기
      const generalId = genData.no || general.no;
      const generalData = { ...general, data: genData, session_id: sessionId };
      await saveGeneral(sessionId, generalId, generalData);

      logger.info('휴가 모드 설정 완료', { userId, sessionId, killturn: vacationKillturn });

      return {
        result: true,
        reason: 'success'
      };
    } catch (error: any) {
      logger.error('휴가 모드 설정 실패', { error: error.message });
      return {
        result: false,
        reason: error.message
      };
    }
  }
}



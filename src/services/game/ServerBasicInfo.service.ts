/**
 * Server Basic Info Service
 * 서버 기본 정보 조회 (j_server_basic_info.php)
 */

import { sessionRepository } from '../../repositories/session.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { generalRepository } from '../../repositories/general.repository';
import { logger } from '../../common/logger';

export class ServerBasicInfoService {
  static async execute(sessionId: string, userId?: string) {
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

      // 국가 수
      const nationCount = await nationRepository.count({
        session_id: sessionId,
        'data.level': { $gt: 0 }
      });

      // 장수 수 (NPC가 아닌)
      const genCount = await generalRepository.count({
        session_id: sessionId,
        'data.npc': { $lt: 2 }
      });

      // NPC 수
      const npcCount = await generalRepository.count({
        session_id: sessionId,
        'data.npc': { $gte: 2 }
      });

      // 기본 정보 구성
      const game = {
        isUnited: sessionData.isunited || 0,
        npcMode: gameEnv.npcmode || 0,
        year: sessionData.year || 184,
        month: sessionData.month || 1,
        scenario: sessionData.scenario || 0,
        scenario_text: sessionData.scenario_text || '삼국지',
        maxUserCnt: sessionData.maxgeneral || 100,
        turnTerm: sessionData.turnterm || 60,
        opentime: sessionData.opentime || session.createdAt,
        lastTurnTime: sessionData.turntime || new Date(),
        join_mode: gameEnv.join_mode || 'full',
        fiction: gameEnv.fiction || 0,
        block_general_create: gameEnv.block_general_create || 0,
        autorun_user: gameEnv.autorun_user || {},
        userCnt: genCount,
        npcCnt: npcCount,
        nationCnt: nationCount,
        defaultStatTotal: 300, // 기본 능력치 총합
        npcModeText: ([0, 1, 2] as const).includes(gameEnv.npcmode) 
          ? (['불가', '가능', '선택 생성'][gameEnv.npcmode]) 
          : '불가',
        fictionMode: gameEnv.fiction ? '가상' : '사실',
        starttime: sessionData.opentime 
          ? (typeof sessionData.opentime === 'string' 
              ? sessionData.opentime.slice(5, 16) 
              : new Date(sessionData.opentime).toISOString().slice(5, 16)) 
          : '',
        turntime: sessionData.turntime 
          ? (typeof sessionData.turntime === 'string' 
              ? sessionData.turntime.slice(5, 16) 
              : new Date(sessionData.turntime).toISOString().slice(5, 16)) 
          : '',
        otherTextInfo: this.getOtherTextInfo(gameEnv)
      };

      // 사용자 정보 (로그인한 경우)
      let me = null;
      if (userId) {
        const general = await generalRepository.findBySessionAndOwner(sessionId, String(userId));

        if (general) {
          const genData = general.data || {};
          me = {
            name: genData.name || general.name,
            picture: genData.picture || ''
          };
        }
      }

      return {
        result: true,
        game,
        me
      };
    } catch (error: any) {
      logger.error('서버 기본 정보 조회 실패', { error: error.message });
      return {
        result: false,
        reason: error.message
      };
    }
  }

  private static getOtherTextInfo(gameEnv: any): string {
    const info: string[] = [];

    if (gameEnv.join_mode === 'onlyRandom') {
      info.push('랜덤 임관 전용');
    }

    if (gameEnv.autorun_user?.limit_minutes) {
      info.push(`자동 턴: ${gameEnv.autorun_user.limit_minutes}분`);
    }

    return info.length > 0 ? info.join(', ') : '표준';
  }
}


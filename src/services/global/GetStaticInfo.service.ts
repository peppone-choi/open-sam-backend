import { sessionRepository } from '../../repositories/session.repository';
import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { getSession } from '../../common/cache/model-cache.helper';
import { ISession } from '../../models/session.model';

export class GetStaticInfoService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';

    try {
      // Load session (L1 → L2 → DB)
      const session = await getSession(sessionId) as ISession | null;
      if (!session) {
        return {
          success: false,
          message: 'Session not found'
        };
      }

      const sessionData = session.data || {};

      // Repository 사용
      const nationCount = await nationRepository.count({
        session_id: sessionId,
        'data.level': { $gt: 0 }
      });

      const generalCount = await generalRepository.count({
        session_id: sessionId,
        owner: { $ne: 'NPC' }
      });

      const npcCount = await generalRepository.count({
        session_id: sessionId,
        owner: 'NPC'
      });

      return {
        success: true,
        result: true,
        game: {
          scenario: sessionData.scenario_text || sessionData.scenario || 'Unknown',
          year: (sessionData.game_env?.year || sessionData.year || session.year || 180),
          month: (sessionData.game_env?.month || sessionData.month || session.month || 1),
          startYear: (sessionData.game_env?.startyear || sessionData.startyear || session.startyear || 180),
          turnTerm: sessionData.turnterm || 60, // 분 단위
          maxUserCnt: sessionData.maxgeneral || 50,
          userCnt: generalCount,
          npcCnt: npcCount,
          nationCnt: nationCount,
          isUnited: sessionData.isunited || 0,
          npcMode: sessionData.npcmode || 0,
          fictionMode: sessionData.fiction ? '가상' : '사실',
          block_general_create: sessionData.block_general_create || 0,
          defaultStatTotal: 240
        }
      };
    } catch (error: any) {
      console.error('GetStaticInfo error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

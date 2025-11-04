/**
 * Get My Boss Info Service
 * 내 상관 정보 조회 (j_myBossInfo.php)
 */

import { General } from '../../models/general.model';
import { logger } from '../../common/logger';

export class GetMyBossInfoService {
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
      // 자신의 장수 조회
      const me = await (General as any).findOne({
        session_id: sessionId,
        owner: String(userId)
      }).lean();

      if (!me) {
        return {
          result: false,
          reason: '장수를 찾을 수 없습니다'
        };
      }

      const meData = me.data || {};
      const myNation = meData.nation || 0;
      const myOfficerLevel = meData.officer_level || 0;
      const myCity = meData.city || 0;

      // 상관 찾기 (같은 국가, 더 높은 관직)
      let boss: any = null;

      if (myNation > 0) {
        // 국가 상관: 같은 국가, 더 높은 officer_level (군주 제외)
        const nationBoss = await (General as any)
          .findOne({
            session_id: sessionId,
            'data.nation': myNation,
            'data.officer_level': { $gt: myOfficerLevel, $lt: 12 }
          })
          .sort({ 'data.officer_level': -1 })
          .lean();

        if (nationBoss) {
          const bossData = nationBoss.data || {};
          boss = {
            no: bossData.no || nationBoss.no,
            name: bossData.name || nationBoss.name,
            officer_level: bossData.officer_level || 0,
            nation: bossData.nation || 0,
            city: bossData.city || 0
          };
        }

        // 도시 상관: 같은 도시, 더 높은 officer_level
        if (myCity > 0 && !boss) {
          const cityBoss = await (General as any)
            .findOne({
              session_id: sessionId,
              'data.city': myCity,
              'data.officer_level': { $gt: myOfficerLevel, $lt: 5 } // 도시 관직 범위
            })
            .sort({ 'data.officer_level': -1 })
            .lean();

          if (cityBoss) {
            const bossData = cityBoss.data || {};
            boss = {
              no: bossData.no || cityBoss.no,
              name: bossData.name || cityBoss.name,
              officer_level: bossData.officer_level || 0,
              nation: bossData.nation || 0,
              city: bossData.city || 0
            };
          }
        }

        // 군주 조회
        const chief = await (General as any)
          .findOne({
            session_id: sessionId,
            'data.nation': myNation,
            'data.officer_level': 12
          })
          .lean();

        if (chief) {
          const chiefData = chief.data || {};
          boss = {
            no: chiefData.no || chief.no,
            name: chiefData.name || chief.name,
            officer_level: 12,
            nation: chiefData.nation || 0,
            isChief: true
          };
        }
      }

      return {
        result: true,
        bossInfo: boss || null
      };
    } catch (error: any) {
      logger.error('상관 정보 조회 실패', { error: error.message });
      return {
        result: false,
        reason: error.message
      };
    }
  }
}


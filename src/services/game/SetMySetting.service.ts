/**
 * Set My Setting Service
 * 내 설정 변경 (j_set_my_setting.php)
 */

import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { logger } from '../../common/logger';

export class SetMySettingService {
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
      const general = await generalRepository.findBySessionAndOwner(sessionId, String(userId));

      if (!general) {
        return {
          result: false,
          reason: '장수를 찾을 수 없습니다'
        };
      }

      const genData = general.data || {};
      const action = data.action;
      const tnmt = data.tnmt !== undefined ? data.tnmt : 1;
      const defenceTrain = data.defence_train !== undefined ? data.defence_train : 80;
      const useTreatment = data.use_treatment !== undefined ? data.use_treatment : 10;
      const useAutoNationTurn = data.use_auto_nation_turn !== undefined ? data.use_auto_nation_turn : 1;

      // 방어 훈련 설정
      let finalDefenceTrain = defenceTrain;
      if (finalDefenceTrain <= 40) {
        finalDefenceTrain = 40;
      } else if (finalDefenceTrain <= 90) {
        finalDefenceTrain = Math.round(finalDefenceTrain / 10) * 10;
      } else {
        finalDefenceTrain = 999;
      }

      // 토너먼트 신청 여부
      if (tnmt < 0 || tnmt > 1) {
        return {
          result: false,
          reason: '토너먼트 신청 값이 올바르지 않습니다'
        };
      }

      // 설정 업데이트
      if (finalDefenceTrain !== (genData.defence_train || 80)) {
        genData.defence_train = finalDefenceTrain;
        if (finalDefenceTrain === 999) {
          // myset 감소 등 추가 로직 필요시 구현
        }
      }

      genData.tnmt = tnmt;
      genData.use_treatment = Math.max(10, Math.min(100, useTreatment));
      genData.use_auto_nation_turn = useAutoNationTurn;

      general.data = genData;
      await general.save();

      logger.info('내 설정 변경 완료', { userId, sessionId, defenceTrain: finalDefenceTrain, tnmt });

      return {
        result: true,
        reason: 'success'
      };
    } catch (error: any) {
      logger.error('내 설정 변경 실패', { error: error.message });
      return {
        result: false,
        reason: error.message
      };
    }
  }
}



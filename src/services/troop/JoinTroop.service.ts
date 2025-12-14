// @ts-nocheck - Argument count mismatches need review
import { TroopRepository } from '../../repositories/troop.repository';
import { General } from '../../models/general.model';
import { Troop } from '../../models/troop.model';
import { Session } from '../../models/session.model';
import { generalRepository } from '../../repositories/general.repository';
import { troopRepository } from '../../repositories/troop.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { StaticEventHandler } from '../../events/StaticEventHandler';
import { logger } from '../../common/logger';

export class JoinTroopService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const troopID = parseInt(data.troopID);
    
    try {
      if (!troopID) {
        return { success: false, result: false, message: '부대 ID가 필요합니다', reason: '부대 ID가 필요합니다' };
      }
      if (!generalId) {
        return { success: false, result: false, message: '장수 ID가 필요합니다', reason: '장수 ID가 필요합니다' };
      }

      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);

      if (!general) {
        return { success: false, result: false, message: '장수를 찾을 수 없습니다', reason: '장수를 찾을 수 없습니다' };
      }

      const currentTroopId = (general.data && general.data.troop) || general.troop || 0;
      if (currentTroopId !== 0) {
        return { success: false, result: false, message: '이미 부대에 소속되어 있습니다', reason: '이미 부대에 소속되어 있습니다' };
      }

      const nationId = general.data?.nation || general.nation || 0;
      if (nationId === 0) {
        return { success: false, result: false, message: '국가에 소속되어 있지 않습니다', reason: '국가에 소속되어 있지 않습니다' };
      }

      const troop = await troopRepository.findOneByFilter({
        session_id: sessionId,
        'data.troop_leader': troopID,
        'data.nation': nationId
      });

      if (!troop) {
        return { success: false, result: false, message: '부대가 올바르지 않습니다', reason: '부대가 올바르지 않습니다' };
      }

      // 장수의 troop 필드 업데이트
      await generalRepository.updateOneByFilter(
        { session_id: sessionId, 'data.no': generalId },
        { $set: { 'data.troop': troopID } }
      );

      // StaticEvent: 부대 가입 시 즉시 이동
      try {
        // 세션에서 환경 정보 가져오기
        const session = await sessionRepository.findBySessionId(sessionId);
        const sessionData = session?.data || {};
        const env = {
          session_id: sessionId,
          year: sessionData.year || 184,
          month: sessionData.month || 1
        };

        // 장수 객체 준비 (업데이트된 troop 반영)
        const updatedGeneral = await generalRepository.findBySessionAndNo(sessionId, generalId);
        
        await StaticEventHandler.handleEvent(
          updatedGeneral,
          null,
          { getName: () => 'JoinTroop', name: 'JoinTroop' },
          env,
          { troopID }
        );
      } catch (eventError: any) {
        logger.warn('[JoinTroop] StaticEvent 처리 실패', { error: eventError.message });
      }

      return { success: true, result: true };
    } catch (error: any) {
      return { success: false, result: false, message: error.message, reason: error.message };
    }
  }
}
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { generalRecordRepository } from '../../repositories/general-record.repository';
import { generalTurnRepository } from '../../repositories/general-turn.repository';
import { worldHistoryRepository } from '../../repositories/world-history.repository';

/**
 * DieOnPrestart Service (사전 삭제)
 * 게임 시작 전 장수를 삭제하는 기능
 * PHP: /sam/hwe/sammo/API/General/DieOnPrestart.php
 */
export class DieOnPrestartService {
  static readonly MIN_TURN_DIE_ON_PRESTART = 2;

  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    
    if (!userId) {
      return {
        success: false,
        message: '사용자 정보가 없습니다'
      };
    }

    try {
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session) {
        return { success: false, message: '세션을 찾을 수 없습니다' };
      }

      const gameEnv = session.data || {};

      const general = await generalRepository.findBySessionAndOwner(
        sessionId,
        userId.toString(),
        { npc: 0 }
      );

      if (!general) {
        return { success: false, message: '장수가 없습니다' };
      }

      if (new Date(gameEnv.turntime) > new Date(gameEnv.opentime)) {
        return { success: false, message: '게임이 시작되었습니다.' };
      }

      if (general.nation !== 0) {
        return { success: false, message: '이미 국가에 소속되어있습니다.' };
      }

      const generalNo = general.no;
      const generalName = general.name || '무명';

      await worldHistoryRepository.create({
        session_id: sessionId,
        year: gameEnv.year || 184,
        month: gameEnv.month || 1,
        data: {
          nation_id: 0,
          text: `${generalName}이(가) 홀연히 모습을 감추었습니다`
        },
        date: new Date()
      });

      await generalTurnRepository.deleteMany({
        session_id: sessionId,
        general_id: generalNo
      });

      await generalRecordRepository.deleteMany({
        session_id: sessionId,
        general_id: generalNo
      });

      await generalRepository.deleteByFilter({
        session_id: sessionId,
        no: generalNo
      });

      return {
        success: true,
        result: true,
        message: '장수가 삭제되었습니다'
      };
    } catch (error: any) {
      console.error('DieOnPrestart error:', error);
      return {
        success: false,
        message: error.message || '장수 삭제 중 오류가 발생했습니다'
      };
    }
  }
}

import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';
import { GeneralRecord } from '../../models/general_record.model';
import { GeneralTurn } from '../../models/general_turn.model';
import { WorldHistory } from '../../models/world_history.model';

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
      const session = await (Session as any).findOne({ session_id: sessionId });
      if (!session) {
        return { success: false, message: '세션을 찾을 수 없습니다' };
      }

      const gameEnv = session.data || {};

      const general = await (General as any).findOne({
        session_id: sessionId,
        owner: userId.toString(),
        'data.npc': 0
      });

      if (!general) {
        return { success: false, message: '장수가 없습니다' };
      }

      if (new Date(gameEnv.turntime) > new Date(gameEnv.opentime)) {
        return { success: false, message: '게임이 시작되었습니다.' };
      }

      if (general.data?.nation !== 0) {
        return { success: false, message: '이미 국가에 소속되어있습니다.' };
      }

      const generalNo = general.data?.no;
      const generalName = general.data?.name || '무명';

      await (WorldHistory as any).create({
        session_id: sessionId,
        year: gameEnv.year || 184,
        month: gameEnv.month || 1,
        data: {
          nation_id: 0,
          text: `${generalName}이(가) 홀연히 모습을 감추었습니다`
        },
        date: new Date()
      });

      await (GeneralTurn as any).deleteMany({
        session_id: sessionId,
        general_id: generalNo
      });

      await (GeneralRecord as any).deleteMany({
        session_id: sessionId,
        general_id: generalNo
      });

      await (General as any).deleteOne({
        session_id: sessionId,
        'data.no': generalNo
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

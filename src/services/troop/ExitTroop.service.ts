import { TroopRepository } from '../../repositories/troop.repository';
import { General } from '../../models/general.model';
import { Troop } from '../../models/troop.model';
import { Session } from '../../models/session.model';

export class ExitTroopService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    
    try {
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      const general = await General.findOne({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const troopId = general.data?.troop || 0;
      if (troopId === 0) {
        return { success: false, message: '부대에 소속되어 있지 않습니다' };
      }

      // 부대장이면 부대 해체
      if (troopId === generalId) {
        await General.updateMany(
          { session_id: sessionId, 'data.troop': troopId },
          { $set: { 'data.troop': 0 } }
        );
        await Troop.deleteOne({
          session_id: sessionId,
          'data.troop_leader': troopId
        });
      } else {
        // 일반 부대원이면 탈퇴
        await General.updateOne(
          { session_id: sessionId, 'data.no': generalId },
          { $set: { 'data.troop': 0 } }
        );
      }

      return { success: true, result: true };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}
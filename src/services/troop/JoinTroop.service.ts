import { TroopRepository } from '../../repositories/troop.repository';
import { General } from '../../models/general.model';
import { Troop } from '../../models/troop.model';
import { Session } from '../../models/session.model';

export class JoinTroopService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const troopID = parseInt(data.troopID);
    
    try {
      if (!troopID) {
        return { success: false, message: '부대 ID가 필요합니다' };
      }
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

      if (general.data?.troop && general.data.troop !== 0) {
        return { success: false, message: '이미 부대에 소속되어 있습니다' };
      }

      const nationId = general.data?.nation || 0;
      if (nationId === 0) {
        return { success: false, message: '국가에 소속되어 있지 않습니다' };
      }

      const troop = await Troop.findOne({
        session_id: sessionId,
        'data.troop_leader': troopID,
        'data.nation': nationId
      });

      if (!troop) {
        return { success: false, message: '부대가 올바르지 않습니다' };
      }

      await General.updateOne(
        { session_id: sessionId, 'data.no': generalId },
        { $set: { 'data.troop': troopID } }
      );

      return { success: true, result: true };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}
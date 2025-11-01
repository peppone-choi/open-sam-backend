import { TroopRepository } from '../../repositories/troop.repository';
import { General } from '../../models/general.model';
import { Troop } from '../../models/troop.model';
import { Session } from '../../models/session.model';

export class KickFromTroopService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const targetGeneralID = parseInt(data.targetGeneralID);
    
    try {
      if (!targetGeneralID) {
        return { success: false, message: '대상 장수 ID가 필요합니다' };
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

      const troopId = general.data?.troop || 0;
      if (troopId === 0) {
        return { success: false, message: '부대에 소속되어 있지 않습니다' };
      }

      if (troopId !== generalId) {
        return { success: false, message: '부대장만 추방할 수 있습니다' };
      }

      const targetGeneral = await General.findOne({
        session_id: sessionId,
        'data.no': targetGeneralID
      });

      if (!targetGeneral) {
        return { success: false, message: '대상 장수를 찾을 수 없습니다' };
      }

      if (targetGeneral.data?.troop !== troopId) {
        return { success: false, message: '대상 장수가 같은 부대에 소속되어 있지 않습니다' };
      }

      if (targetGeneralID === generalId) {
        return { success: false, message: '자기 자신을 추방할 수 없습니다' };
      }

      await General.updateOne(
        { session_id: sessionId, 'data.no': targetGeneralID },
        { $set: { 'data.troop': 0 } }
      );

      return { success: true, result: true };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}
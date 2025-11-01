import { TroopRepository } from '../../repositories/troop.repository';
import { General } from '../../models/general.model';
import { Troop } from '../../models/troop.model';
import { Session } from '../../models/session.model';

export class ModifyTroopService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const troopId = parseInt(data.troopID);
    const troopData = data.troopData;
    
    try {
      if (!troopId) {
        return { success: false, message: '부대 ID가 필요합니다' };
      }
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }
      if (!troopData) {
        return { success: false, message: '수정할 부대 정보가 필요합니다' };
      }

      const general = await General.findOne({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const myTroopId = general.data?.troop || 0;
      if (myTroopId === 0) {
        return { success: false, message: '부대에 소속되어 있지 않습니다' };
      }

      if (myTroopId !== troopId) {
        return { success: false, message: '다른 부대의 정보를 수정할 수 없습니다' };
      }

      if (myTroopId !== generalId) {
        return { success: false, message: '부대장만 부대 정보를 수정할 수 있습니다' };
      }

      const nationId = general.data?.nation || 0;
      const updateData: any = {};
      
      if (troopData.name !== undefined) {
        if (!troopData.name || troopData.name.length === 0 || troopData.name.length > 18) {
          return { success: false, message: '부대 이름은 1~18자여야 합니다' };
        }
        updateData['data.name'] = troopData.name;
      }

      const result = await Troop.updateOne(
        { 
          session_id: sessionId, 
          'data.troop_leader': troopId,
          'data.nation': nationId
        },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        return { success: false, message: '부대를 찾을 수 없습니다' };
      }

      return { success: true, result: true };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

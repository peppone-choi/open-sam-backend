import { TroopRepository } from '../../repositories/troop.repository';
import { General } from '../../models/general.model';
import { Troop } from '../../models/troop.model';
import { Session } from '../../models/session.model';
import { generalRepository } from '../../repositories/general.repository';
import { troopRepository } from '../../repositories/troop.repository';

export class NewTroopService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const troopName = data.troopName;
    
    try {
      if (!troopName || troopName.length === 0 || troopName.length > 18) {
        return { success: false, message: '부대 이름은 1~18자여야 합니다' };
      }
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      const general = await generalRepository.findBySessionAndNo({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const troopId = general.data?.troop || 0;
      if (troopId !== 0) {
        return { success: false, message: '이미 부대에 소속되어 있습니다' };
      }

      const nationId = general.data?.nation || 0;
      if (nationId === 0) {
        return { success: false, message: '국가에 소속되어 있지 않습니다' };
      }

      await troopRepository.create({
        session_id: sessionId,
        data: {
          name: troopName,
          troop_leader: generalId,
          nation: nationId,
          created_at: new Date()
        }
      });

      await generalRepository.updateOneByFilter(
        { session_id: sessionId, 'data.no': generalId },
        { $set: { 'data.troop': generalId } }
      );

      return { success: true, result: true };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}
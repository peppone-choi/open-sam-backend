// @ts-nocheck - Argument count mismatches need review
import { TroopRepository } from '../../repositories/troop.repository';
import { General } from '../../models/general.model';
import { Troop } from '../../models/troop.model';
import { Session } from '../../models/session.model';
import { generalRepository } from '../../repositories/general.repository';
import { troopRepository } from '../../repositories/troop.repository';

export class SetLeaderCandidateService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const candidateId = parseInt(data.candidateID);
    
    try {
      if (!candidateId) {
        return { success: false, message: '후보 장수 ID가 필요합니다' };
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
      if (troopId === 0) {
        return { success: false, message: '부대에 소속되어 있지 않습니다' };
      }

      if (troopId !== generalId) {
        return { success: false, message: '부대장만 후보를 지정할 수 있습니다' };
      }

      const candidate = await generalRepository.findBySessionAndNo({
        session_id: sessionId,
        'data.no': candidateId
      });

      if (!candidate) {
        return { success: false, message: '후보 장수를 찾을 수 없습니다' };
      }

      if (candidate.data?.troop !== troopId) {
        return { success: false, message: '같은 부대의 장수만 후보로 지정할 수 있습니다' };
      }

      const nationId = general.data?.nation || 0;
      const result = await troopRepository.updateOneByFilter(
        { 
          session_id: sessionId, 
          'data.troop_leader': troopId,
          'data.nation': nationId
        },
        { $set: { 'data.leader_candidate': candidateId } }
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

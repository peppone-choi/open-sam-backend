import { generalRepository } from '../../repositories/general.repository';
import { troopRepository } from '../../repositories/troop.repository';

/**
 * SetTroopName Service
 * 부대 이름 설정
 * PHP: /sam/hwe/sammo/API/Nation/SetTroopName.php
 */
export class SetTroopNameService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const troopID = parseInt(data.troopID || data.troop_id);
    const troopName = (data.troopName || data.troop_name || '').trim();
    
    try {
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      if (!troopID) {
        return { success: false, message: '부대 ID가 필요합니다' };
      }

      if (!troopName) {
        return { success: false, message: '부대 이름이 필요합니다' };
      }

      if (troopName.length > 18) {
        return { success: false, message: '부대 이름은 최대 18자까지 가능합니다' };
      }

      const general = await generalRepository.findBySessionAndNo({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const nationId = general.data?.nation || 0;
      const permission = general.data?.permission || 'normal';

      if (nationId === 0) {
        return { success: false, message: '국가에 소속되어 있어야 합니다' };
      }

      if (generalId !== troopID && permission !== 'ambassador') {
        return { success: false, message: '권한이 부족합니다. 본인 부대이거나 외교권자만 변경 가능합니다' };
      }

      const result = await troopRepository.updateOneByFilter(
        {
          session_id: sessionId,
          'data.troop_leader': troopID,
          'data.nation': nationId
        },
        {
          $set: {
            'data.name': troopName
          }
        }
      );

      if (result.matchedCount === 0) {
        return { success: false, message: '부대를 찾을 수 없습니다' };
      }

      return {
        success: true,
        result: true,
        message: `부대 이름이 ${troopName}(으)로 변경되었습니다`
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

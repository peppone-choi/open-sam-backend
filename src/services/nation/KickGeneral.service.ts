import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { verifyGeneralOwnership } from '../../common/auth-utils';

/**
 * KickGeneral Service
 * 장수 추방 처리
 */
export class KickGeneralService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const userId = user?.userId || user?.id;
    const targetGeneralId = parseInt(data.targetGeneralId || data.target_general_id);
    
    try {
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }
 
      if (!targetGeneralId) {
        return { success: false, message: '대상 장수 ID가 필요합니다' };
      }

      if (!userId) {
        return { success: false, message: '사용자 인증이 필요합니다' };
      }

      const ownershipCheck = await verifyGeneralOwnership(sessionId, Number(generalId), String(userId));
      if (!ownershipCheck.valid) {
        return { success: false, message: ownershipCheck.error || '해당 장수에 대한 권한이 없습니다.' };
      }
 
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);


      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const targetGeneral = await generalRepository.findBySessionAndNo(sessionId, targetGeneralId);

      if (!targetGeneral) {
        return { success: false, message: '대상 장수를 찾을 수 없습니다' };
      }

      const officerLevel = general.data?.officer_level || 0;
      const nationId = general.data?.nation || 0;
      const targetNationId = targetGeneral.data?.nation || 0;
      const targetOfficerLevel = targetGeneral.data?.officer_level || 0;

      if (officerLevel < 5) {
        return { success: false, message: '권한이 부족합니다. 수뇌부만 추방할 수 있습니다' };
      }

      if (nationId === 0) {
        return { success: false, message: '국가에 소속되어 있지 않습니다' };
      }

      if (nationId !== targetNationId) {
        return { success: false, message: '같은 국가의 장수가 아닙니다' };
      }

      if (targetOfficerLevel >= officerLevel) {
        return { success: false, message: '자신보다 직위가 높거나 같은 장수는 추방할 수 없습니다' };
      }

      await generalRepository.updateBySessionAndNo(sessionId, targetGeneralId, {
        'data.nation': 0,
        'data.officer_level': 1,
        'data.belong': 0,
        'data.permission': 'normal',
        'data.troop': 0
      });

      await nationRepository.incrementGennum(sessionId, nationId, -1);

      return {
        success: true,
        result: true,
        message: `${targetGeneral.data?.name || '무명'}을(를) 추방하였습니다`
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

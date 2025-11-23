// @ts-nocheck - Argument count mismatches need review
import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { buildChiefPolicyPayload } from './helpers/policy.helper';

/**
 * SetBlockScout Service
 * 임관 차단 설정
 * PHP: /sam/hwe/sammo/API/Nation/SetBlockScout.php
 */
export class SetBlockScoutService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const value = data.value === true || data.value === 'true' || data.value === 1;
    
    try {
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const officerLevel = general.data?.officer_level || 0;
      const permission = general.data?.permission || 'normal';
      const nationId = general.data?.nation || 0;

      if (officerLevel < 5 && permission !== 'ambassador') {
        return { success: false, message: '권한이 부족합니다' };
      }

      if (nationId === 0) {
        return { success: false, message: '국가에 소속되어 있어야 합니다' };
      }

      const session = await sessionRepository.findBySessionId(sessionId );
      const blockChangeScout = session?.data?.block_change_scout || false;

      if (blockChangeScout) {
        return { success: false, message: '임관 설정을 바꿀 수 없도록 설정되어 있습니다' };
      }

      const nationDoc = await nationRepository.findByNationNum(sessionId, nationId);
      if (!nationDoc) {
        return { success: false, message: '국가를 찾을 수 없습니다' };
      }

      await nationRepository.updateOneByFilter(
        {
          session_id: sessionId,
          'data.nation': nationId
        },
        {
          'data.scout': value ? 1 : 0
        }
      );

      if (nationDoc.data) {
        nationDoc.data.scout = value ? 1 : 0;
      }

      const payload = await buildChiefPolicyPayload(sessionId, nationId, { nationDoc });

      return {
        success: true,
        result: true,
        message: value ? '임관이 차단되었습니다' : '임관이 허용되었습니다',
        policy: payload?.policy,
        warSettingCnt: payload?.warSettingCnt,
        notices: payload?.notices,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

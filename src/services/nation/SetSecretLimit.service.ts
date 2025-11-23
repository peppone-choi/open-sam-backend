// @ts-nocheck - Argument count mismatches need review
import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { buildChiefPolicyPayload } from './helpers/policy.helper';

/**
 * SetSecretLimit Service
 * 사관 제한 설정
 * PHP: /sam/hwe/sammo/API/Nation/SetSecretLimit.php
 */
export class SetSecretLimitService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const amount = parseInt(data.amount);
    
    try {
      if (!amount || amount < 1 || amount > 99) {
        return { success: false, message: '사관 제한은 1~99 사이여야 합니다' };
      }

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
            'data.secretlimit': amount
        }
      );

      if (nationDoc.data) {
        nationDoc.data.secretlimit = amount;
      }

      const payload = await buildChiefPolicyPayload(sessionId, nationId, { nationDoc });

      return {
        success: true,
        result: true,
        message: `사관 제한이 ${amount}년으로 설정되었습니다`,
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

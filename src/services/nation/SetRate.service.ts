// @ts-nocheck - Argument count mismatches need review
import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { buildChiefPolicyPayload } from './helpers/policy.helper';
import { verifyGeneralOwnership } from '../../common/auth-utils';

/**
 * SetRate Service
 * 세율 설정
 * PHP: /sam/hwe/sammo/API/Nation/SetRate.php
 */
export class SetRateService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const userId = user?.userId || user?.id;
    const amount = parseInt(data.amount);
    
    try {
      if (!amount || amount < 5 || amount > 30) {
        return { success: false, message: '세율은 5~30 사이여야 합니다' };
      }

      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
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
          'data.rate': amount
        }
      );

      if (nationDoc.data) {
        nationDoc.data.rate = amount;
      }

      const payload = await buildChiefPolicyPayload(sessionId, nationId, { nationDoc });

      return {
        success: true,
        result: true,
        message: `세율이 ${amount}%로 설정되었습니다`,
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

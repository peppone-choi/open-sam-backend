// @ts-nocheck - Argument count mismatches need review
import { nationRepository } from '../../repositories/nation.repository';
import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';
import { Session } from '../../models/session.model';
import { generalRepository } from '../../repositories/general.repository';
import { buildChiefPolicyPayload } from './helpers/policy.helper';
import { verifyGeneralOwnership } from '../../common/auth-utils';

/**
 * SetBill Service
 * 국가 공고문 설정 (전략권자 전용)
 * PHP: /sam/hwe/sammo/API/Nation/SetBill.php
 */
export class SetBillService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const userId = user?.userId || user?.id;
    const amount = parseInt(data.amount);
    
    try {
      // 입력 검증
      if (!amount || amount < 20 || amount > 200) {
        return {
          success: false,
          message: '공고 금액은 20~200 사이여야 합니다'
        };
      }

      if (!generalId) {
        return {
          success: false,
          message: '장수 정보가 필요합니다'
        };
      }

      if (!userId) {
        return {
          success: false,
          message: '사용자 인증이 필요합니다'
        };
      }

      const ownershipCheck = await verifyGeneralOwnership(sessionId, Number(generalId), String(userId));
      if (!ownershipCheck.valid) {
        return {
          success: false,
          message: ownershipCheck.error || '해당 장수에 대한 권한이 없습니다.'
        };
      }
 
      // 장수 정보 조회
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);


      if (!general) {
        return {
          success: false,
          message: '장수를 찾을 수 없습니다'
        };
      }

      const officerLevel = general.data?.officer_level || 0;
      const permission = general.data?.permission;
      const nationId = general.data?.nation;

      // 권한 체크: 장수(officer_level >= 5) 또는 전략권자(permission === 'strategic')
      if (officerLevel < 5 && permission !== 'strategic') {
        return {
          success: false,
          message: '권한이 부족합니다. 장수 이상이거나 전략권자여야 합니다'
        };
      }

      if (!nationId || nationId === 0) {
        return {
          success: false,
          message: '국가에 소속되어 있어야 합니다'
        };
      }

      // 국가 정보 업데이트
      const nationDoc = await nationRepository.findByNationNum(sessionId, nationId);
      if (!nationDoc) {
        return {
          success: false,
          message: '국가를 찾을 수 없습니다'
        };
      }

      const result = await nationRepository.updateOneByFilter(
        {
          session_id: sessionId,
          'data.nation': nationId
        },
        {
          'data.bill': amount
        }
      );

      if (result.matchedCount === 0) {
        return {
          success: false,
          message: '국가를 찾을 수 없습니다'
        };
      }

      if (nationDoc.data) {
        nationDoc.data.bill = amount;
      }

      const payload = await buildChiefPolicyPayload(sessionId, nationId, { nationDoc });

      return {
        success: true,
        result: true,
        message: `공고 금액이 ${amount}으로 설정되었습니다`,
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

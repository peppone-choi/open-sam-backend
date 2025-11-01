import { General } from '../../models/general.model';

/**
 * GrantPower Service
 * 외교권자/조언자 권한 부여
 * PHP: /sam/hwe/j_general_set_permission.php
 */
export class GrantPowerService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const isAmbassador = data.isAmbassador === true || data.isAmbassador === 'true';
    const genlist = data.genlist || [];
    
    try {
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

      const officerLevel = general.data?.officer_level || 0;
      const nationId = general.data?.nation || 0;

      if (officerLevel !== 12) {
        return { success: false, message: '군주가 아닙니다' };
      }

      if (nationId === 0) {
        return { success: false, message: '국가에 소속되어 있지 않습니다' };
      }

      const targetType = isAmbassador ? 'ambassador' : 'auditor';
      const targetLevel = isAmbassador ? 4 : 3;

      if (isAmbassador && genlist.length > 2) {
        return { success: false, message: '외교권자는 최대 2명까지만 설정 가능합니다' };
      }

      await General.updateMany(
        {
          session_id: sessionId,
          'data.nation': nationId,
          'data.permission': targetType
        },
        {
          $set: {
            'data.permission': 'normal'
          }
        }
      );

      if (!genlist || genlist.length === 0) {
        return {
          success: true,
          result: true,
          message: '권한이 초기화되었습니다'
        };
      }

      const candidates = await General.find({
        session_id: sessionId,
        'data.nation': nationId,
        'data.no': { $in: genlist },
        'data.officer_level': { $ne: 12 },
        'data.permission': 'normal'
      });

      const realCandidates = candidates.filter(candidate => {
        const maxPermission = this.checkSecretMaxPermission(candidate.data || {});
        return maxPermission >= targetLevel;
      });

      if (realCandidates.length === 0) {
        return {
          success: true,
          result: true,
          message: '조건을 만족하는 후보가 없습니다'
        };
      }

      const candidateIds = realCandidates.map(c => c.data?.no);

      await General.updateMany(
        {
          session_id: sessionId,
          'data.no': { $in: candidateIds }
        },
        {
          $set: {
            'data.permission': targetType
          }
        }
      );

      return {
        success: true,
        result: true,
        message: `${targetType === 'ambassador' ? '외교권자' : '조언자'}가 설정되었습니다`
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  private static checkSecretMaxPermission(genData: any): number {
    const penalty = genData.penalty || 0;
    if (penalty > 0) return -1;
    
    const dedication = genData.dedication || 0;
    if (dedication >= 24) return 4;
    if (dedication >= 12) return 3;
    if (dedication >= 1) return 1;
    
    return 0;
  }
}

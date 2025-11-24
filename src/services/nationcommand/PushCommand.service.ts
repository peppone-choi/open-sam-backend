import { generalRepository } from '../../repositories/general.repository';
import { pushNationCommand, pullNationCommand } from '../../utils/command-helpers';
import { verifyGeneralOwnership } from '../../common/auth-utils';

export class PushCommandService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const userId = user?.userId || user?.id;
    const amount = parseInt(data.amount);
    
    try {
      if (!generalId) {
        throw new Error('장수 ID가 필요합니다.');
      }

      if (!userId) {
        throw new Error('사용자 인증이 필요합니다.');
      }

      const ownershipCheck = await verifyGeneralOwnership(sessionId, Number(generalId), userId);
      if (!ownershipCheck.valid) {
        throw new Error(ownershipCheck.error || '해당 장수에 대한 권한이 없습니다.');
      }

      if (isNaN(amount)) {
        throw new Error('amount가 숫자가 아닙니다.');
      }

      if (amount === 0) {
        throw new Error('0은 불가능합니다');
      }

      if (amount < -12 || amount > 12) {
        throw new Error('증감 값은 -12 ~ 12 범위만 허용됩니다.');
      }

      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);

      if (!general) {
        throw new Error('올바르지 않은 장수입니다.');
      }

      const generalData = general.data;
      const nationId = generalData.nation;
      const officerLevel = generalData.officer_level || 1;

      if (!nationId) {
        throw new Error('국가에 소속되어 있지 않습니다.');
      }

      if (officerLevel < 5) {
        throw new Error('수뇌가 아닙니다.');
      }

      if (amount > 0) {
        await pushNationCommand(sessionId, nationId, officerLevel, amount);
      } else {
        await pullNationCommand(sessionId, nationId, officerLevel, -amount);
      }

      return {
        success: true,
        result: true,
        message: '국가 명령 조정이 완료되었습니다.'
      };

    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

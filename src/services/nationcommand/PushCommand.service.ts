import { General } from '../../models/general.model';
import { pushNationCommand, pullNationCommand } from '../../utils/command-helpers';

export class PushCommandService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const amount = parseInt(data.amount);
    
    try {
      if (isNaN(amount)) {
        throw new Error('amount가 숫자가 아닙니다.');
      }

      if (amount === 0) {
        throw new Error('0은 불가능합니다');
      }

      if (amount < -12 || amount > 12) {
        throw new Error('범위를 벗어났습니다 (-12 ~ 12)');
      }

      const general = await General.findOne({
        session_id: sessionId,
        'data.no': generalId
      });

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
        message: 'PushCommand executed successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
